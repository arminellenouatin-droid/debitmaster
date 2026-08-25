-- DebitManager: split cash/mobile payments, but settle the order only at 100% paid.
begin;

create or replace function public.settle_order_stock_after_payment(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, private
as $$
declare
  order_row public.orders;
  paid_total integer;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() is not null and order_row.server_user_id <> auth.uid() then raise exception 'ORDER_SERVER_ONLY'; end if;
  if order_row.status = 'PAID' then return order_row; end if;
  if order_row.status not in ('HANDED_OFF', 'DELIVERED') then raise exception 'ORDER_NOT_READY_FOR_SETTLEMENT'; end if;

  select coalesce(sum(p.amount), 0)::integer into paid_total
  from public.payments p
  where p.order_id = order_row.id and p.tenant_id = order_row.tenant_id and p.status in ('PAID', 'SUCCESS');
  if paid_total < order_row.total_amount then raise exception 'PAYMENT_INCOMPLETE'; end if;

  update public.order_stock_allocations
  set status = 'SETTLED', settled_at = now(), settled_by = auth.uid(), updated_at = now()
  where order_id = order_row.id and status = 'ALLOCATED';

  if not exists (select 1 from public.order_stock_allocations a where a.order_id = order_row.id and a.status = 'SETTLED') then
    raise exception 'ORDER_STOCK_NOT_ALLOCATED';
  end if;

  update public.orders set status = 'PAID', updated_at = now()
  where id = order_row.id and status in ('HANDED_OFF', 'DELIVERED')
  returning * into order_row;
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
  if order_row.status not in ('HANDED_OFF', 'DELIVERED') then raise exception 'ORDER_NOT_READY_FOR_PAYMENT'; end if;

  select coalesce(sum(p.amount), 0)::integer into paid_total
  from public.payments p where p.order_id = order_row.id and p.tenant_id = order_row.tenant_id and p.status in ('PAID', 'SUCCESS');
  remaining := order_row.total_amount - paid_total;
  if p_amount > remaining then raise exception 'PAYMENT_EXCEEDS_REMAINING'; end if;

  insert into public.payments (tenant_id, order_id, provider, payment_method, status, amount, currency, paid_at)
  values (order_row.tenant_id, order_row.id, 'CASH', 'CASH', 'PAID', p_amount, order_row.currency, now())
  returning * into payment_row;

  if paid_total + p_amount = order_row.total_amount then
    perform public.settle_order_stock_after_payment(order_row.id);
  end if;
  return payment_row;
end;
$$;

grant execute on function public.record_cash_payment(uuid, integer) to authenticated;

create or replace function public.record_cash_payment_and_settle(p_order_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public, private
as $$
declare
  order_total integer;
begin
  select total_amount into order_total from public.orders where id = p_order_id;
  return public.record_cash_payment(p_order_id, order_total);
end;
$$;

grant execute on function public.record_cash_payment_and_settle(uuid) to authenticated;

commit;
