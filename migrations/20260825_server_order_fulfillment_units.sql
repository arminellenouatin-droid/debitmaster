-- DebitManager: one parent order, independent preparation units for beverages and meals.
begin;

alter table public.order_items
  add column if not exists fulfillment_unit text not null default 'BEVERAGE',
  add column if not exists preparation_status text not null default 'PENDING',
  add column if not exists prepared_at timestamptz,
  add column if not exists received_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists received_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.order_items
drop constraint if exists order_items_fulfillment_unit_check;
alter table public.order_items
add constraint order_items_fulfillment_unit_check
check (fulfillment_unit in ('BEVERAGE', 'MEAL'));

alter table public.order_items
drop constraint if exists order_items_preparation_status_check;
alter table public.order_items
add constraint order_items_preparation_status_check
check (preparation_status in ('PENDING', 'IN_PREPARATION', 'READY', 'RECEIVED', 'DELIVERED'));

create index if not exists order_items_fulfillment_idx
  on public.order_items (tenant_id, fulfillment_unit, preparation_status, created_at desc);

create or replace function public.refresh_order_status_from_items(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, private
as $$
declare
  order_row public.orders;
  item_count integer;
  delivered_count integer;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;

  select count(*), count(*) filter (where preparation_status in ('DELIVERED', 'RECEIVED'))
  into item_count, delivered_count
  from public.order_items
  where order_id = p_order_id;

  if item_count > 0 and delivered_count = item_count and order_row.status in ('HANDED_OFF', 'DELIVERED') then
    update public.orders
    set status = 'DELIVERED', delivered_at = coalesce(delivered_at, now()), updated_at = now()
    where id = p_order_id
    returning * into order_row;
  end if;
  return order_row;
end;
$$;

grant execute on function public.refresh_order_status_from_items(uuid) to authenticated;

commit;

-- Item-level handoff: a mixed order can be received progressively by the assigned server.
begin;

create or replace function public.receive_order_item_for_server(p_order_item_id uuid)
returns public.order_items
language plpgsql
security definer
set search_path = public, private
as $$
declare
  item_row public.order_items;
  order_row public.orders;
  counter_store public.inventory_stores;
  position_row public.store_inventory;
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

  select * into counter_store from public.inventory_stores
  where tenant_id = order_row.tenant_id and store_type = 'COUNTER' and is_active
  order by created_at limit 1 for update;
  if counter_store.id is null then raise exception 'COUNTER_STORE_NOT_FOUND'; end if;

  select * into position_row from public.store_inventory
  where tenant_id = order_row.tenant_id and store_id = counter_store.id and product_id = item_row.product_id
  for update;
  if position_row.id is null or position_row.quantity - position_row.reserved_quantity < item_row.quantity then
    raise exception 'INSUFFICIENT_COUNTER_STOCK';
  end if;

  update public.store_inventory
  set quantity = quantity - item_row.quantity, updated_at = now()
  where id = position_row.id;

  insert into public.order_stock_allocations
    (tenant_id, order_id, order_item_id, product_id, server_user_id, quantity)
  values
    (order_row.tenant_id, order_row.id, item_row.id, item_row.product_id, auth.uid(), item_row.quantity)
  on conflict (order_item_id) do update
    set updated_at = now();

  insert into public.stock_movements
    (tenant_id, product_id, movement_type, quantity, reason, responsible_user_id, store_id, order_id, server_user_id)
  values
    (order_row.tenant_id, item_row.product_id, 'OUT_SALE', -item_row.quantity,
     'Article remis au serveur pour la commande', auth.uid(), counter_store.id, order_row.id, auth.uid());

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

commit;
