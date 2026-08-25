-- DebitManager: le paiement peut être lancé à tout moment.
-- La vente et la sortie de stock sont finalisées uniquement au paiement total.
-- Réception et livraison restent des états opérationnels indépendants.

create or replace function public.receive_order_item_for_server(p_order_item_id uuid)
returns public.order_items
language plpgsql
security definer
set search_path = public, private
as $$
declare
  item_row public.order_items;
  order_row public.orders;
  employee_exists boolean;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select * into item_row from public.order_items where id = p_order_item_id for update;
  if item_row.id is null then raise exception 'ORDER_ITEM_NOT_FOUND'; end if;
  select * into order_row from public.orders where id = item_row.order_id for update;
  if order_row.server_user_id <> auth.uid() then raise exception 'ORDER_NOT_ASSIGNED'; end if;
  if item_row.preparation_status = 'RECEIVED' then return item_row; end if;
  if item_row.preparation_status <> 'READY' then raise exception 'ORDER_ITEM_NOT_READY'; end if;

  select exists (
    select 1 from public.employees e
    where e.tenant_id = order_row.tenant_id and e.user_id = auth.uid()
      and e.position = 'SERVEUR' and e.status = 'ACTIVE' and e.deleted_at is null
  ) into employee_exists;
  if not employee_exists then raise exception 'SERVER_REQUIRED'; end if;

  update public.order_items
  set preparation_status = 'RECEIVED', received_by_user_id = auth.uid(), received_at = now()
  where id = item_row.id
  returning * into item_row;

  update public.orders
  set status = case when status in ('PENDING', 'IN_PREPARATION', 'READY') then 'HANDED_OFF' else status end,
      received_by_user_id = coalesce(received_by_user_id, auth.uid()),
      received_at = coalesce(received_at, now()), updated_at = now()
  where id = order_row.id;
  return item_row;
end;
$$;

grant execute on function public.receive_order_item_for_server(uuid) to authenticated;

create or replace function public.settle_order_stock_after_payment(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, private
as $$
declare
  order_row public.orders;
  item_row public.order_items;
  counter_store public.inventory_stores;
  position_row public.store_inventory;
  paid_total integer;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() is not null and order_row.server_user_id <> auth.uid() then raise exception 'ORDER_SERVER_ONLY'; end if;
  if order_row.status = 'PAID' then return order_row; end if;

  select coalesce(sum(p.amount), 0)::integer into paid_total
  from public.payments p
  where p.order_id = order_row.id and p.tenant_id = order_row.tenant_id and p.status in ('PAID', 'SUCCESS');
  if paid_total < order_row.total_amount then raise exception 'PAYMENT_INCOMPLETE'; end if;

  select * into counter_store from public.inventory_stores
  where tenant_id = order_row.tenant_id and store_type = 'COUNTER' and is_active
  order by created_at limit 1 for update;
  if counter_store.id is null then raise exception 'COUNTER_STORE_NOT_FOUND'; end if;

  for item_row in select * from public.order_items where order_id = order_row.id order by created_at for update loop
    if not exists (select 1 from public.order_stock_allocations a where a.order_item_id = item_row.id and a.status in ('ALLOCATED', 'SETTLED')) then
      select * into position_row from public.store_inventory
      where tenant_id = order_row.tenant_id and store_id = counter_store.id and product_id = item_row.product_id for update;
      if position_row.id is null or position_row.quantity - position_row.reserved_quantity < item_row.quantity then raise exception 'INSUFFICIENT_COUNTER_STOCK'; end if;
      update public.store_inventory set quantity = quantity - item_row.quantity, updated_at = now() where id = position_row.id;
      insert into public.order_stock_allocations (tenant_id, order_id, order_item_id, product_id, server_user_id, quantity)
      values (order_row.tenant_id, order_row.id, item_row.id, item_row.product_id, order_row.server_user_id, item_row.quantity);
      insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reason, responsible_user_id, store_id, order_id, server_user_id)
      values (order_row.tenant_id, item_row.product_id, 'OUT_SALE', -item_row.quantity, 'Vente confirmée par paiement', auth.uid(), counter_store.id, order_row.id, order_row.server_user_id);
    end if;
  end loop;

  update public.order_stock_allocations
  set status = 'SETTLED', settled_at = coalesce(settled_at, now()), settled_by = auth.uid(), updated_at = now()
  where order_id = order_row.id and status = 'ALLOCATED';

  update public.orders set status = 'PAID', updated_at = now() where id = order_row.id returning * into order_row;
  return order_row;
end;
$$;

grant execute on function public.settle_order_stock_after_payment(uuid) to authenticated;

create or replace function public.record_cash_payment(p_order_id uuid, p_amount integer)
returns public.payments
language plpgsql
security definer
set search_path = public, private
as $$
declare
  order_row public.orders;
  payment_row public.payments;
  paid_total integer;
  remaining integer;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
  select * into order_row from public.orders where id = p_order_id for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.server_user_id <> auth.uid() then raise exception 'ORDER_SERVER_ONLY'; end if;
  if order_row.status = 'PAID' then raise exception 'ORDER_ALREADY_PAID'; end if;
  select coalesce(sum(p.amount), 0)::integer into paid_total from public.payments p where p.order_id = order_row.id and p.tenant_id = order_row.tenant_id and p.status in ('PAID', 'SUCCESS');
  remaining := order_row.total_amount - paid_total;
  if p_amount > remaining then raise exception 'PAYMENT_EXCEEDS_REMAINING'; end if;
  insert into public.payments (tenant_id, order_id, provider, payment_method, status, amount, currency, paid_at)
  values (order_row.tenant_id, order_row.id, 'CASH', 'CASH', 'PAID', p_amount, order_row.currency, now()) returning * into payment_row;
  if paid_total + p_amount = order_row.total_amount then perform public.settle_order_stock_after_payment(order_row.id); end if;
  return payment_row;
end;
$$;

grant execute on function public.record_cash_payment(uuid, integer) to authenticated;
