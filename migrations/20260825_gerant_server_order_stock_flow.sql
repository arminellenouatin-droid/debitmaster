-- DebitManager: trace the stock handoff from the Gérant to the server per order and item.
begin;

alter table public.stock_movements
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists server_user_id uuid references auth.users(id) on delete set null;

create index if not exists stock_movements_order_idx
  on public.stock_movements (tenant_id, order_id, created_at desc);

create table if not exists public.order_stock_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  server_user_id uuid not null references auth.users(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'ALLOCATED' check (status in ('ALLOCATED', 'SETTLED', 'VOIDED')),
  allocated_at timestamptz not null default now(),
  settled_at timestamptz,
  settled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id)
);

create index if not exists order_stock_allocations_server_idx
  on public.order_stock_allocations (tenant_id, server_user_id, status, allocated_at desc);
create index if not exists order_stock_allocations_order_idx
  on public.order_stock_allocations (tenant_id, order_id, status);

alter table public.order_stock_allocations enable row level security;
drop policy if exists order_stock_allocations_select_authorized on public.order_stock_allocations;
create policy order_stock_allocations_select_authorized on public.order_stock_allocations
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'orders.view'));

create or replace function public.receive_order_for_server(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, private
as $$
declare
  order_row public.orders;
  counter_store public.inventory_stores;
  item_row public.order_items;
  position_row public.store_inventory;
  employee_exists boolean;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into order_row
  from public.orders
  where id = p_order_id
  for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.status <> 'READY' then raise exception 'ORDER_NOT_READY'; end if;
  if order_row.server_user_id is null or order_row.server_user_id <> auth.uid() then raise exception 'ORDER_NOT_ASSIGNED'; end if;

  select exists (
    select 1 from public.employees e
    where e.tenant_id = order_row.tenant_id
      and e.user_id = auth.uid()
      and e.position = 'SERVEUR'
      and e.status = 'ACTIVE'
      and e.deleted_at is null
  ) into employee_exists;
  if not employee_exists then raise exception 'SERVER_REQUIRED'; end if;

  select * into counter_store
  from public.inventory_stores
  where tenant_id = order_row.tenant_id
    and store_type = 'COUNTER'
    and is_active
  order by created_at
  limit 1
  for update;
  if counter_store.id is null then raise exception 'COUNTER_STORE_NOT_FOUND'; end if;

  for item_row in
    select * from public.order_items where order_id = order_row.id order by created_at for update
  loop
    select * into position_row
    from public.store_inventory
    where tenant_id = order_row.tenant_id
      and store_id = counter_store.id
      and product_id = item_row.product_id
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
      (order_row.tenant_id, order_row.id, item_row.id, item_row.product_id, auth.uid(), item_row.quantity);

    insert into public.stock_movements
      (tenant_id, product_id, movement_type, quantity, reason, responsible_user_id, store_id, order_id, server_user_id)
    values
      (order_row.tenant_id, item_row.product_id, 'OUT_SALE', -item_row.quantity,
       'Commande remise au serveur', auth.uid(), counter_store.id, order_row.id, auth.uid());
  end loop;

  update public.orders
  set status = 'HANDED_OFF', received_by_user_id = auth.uid(), received_at = now(), updated_at = now()
  where id = order_row.id and status = 'READY'
  returning * into order_row;
  if order_row.id is null then raise exception 'ORDER_CHANGED'; end if;
  return order_row;
end;
$$;

grant execute on function public.receive_order_for_server(uuid) to authenticated;

create or replace function public.settle_order_stock_after_payment(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, private
as $$
declare
  order_row public.orders;
  allocation_count integer;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() is not null and order_row.server_user_id <> auth.uid() then raise exception 'ORDER_SERVER_ONLY'; end if;
  if order_row.status = 'PAID' then return order_row; end if;
  if order_row.status not in ('HANDED_OFF', 'DELIVERED') then raise exception 'ORDER_NOT_READY_FOR_SETTLEMENT'; end if;
  if not exists (select 1 from public.payments p where p.order_id = order_row.id and p.tenant_id = order_row.tenant_id and p.status in ('PAID', 'SUCCESS')) then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;

  update public.order_stock_allocations
  set status = 'SETTLED', settled_at = now(), settled_by = auth.uid(), updated_at = now()
  where order_id = order_row.id and status = 'ALLOCATED';
  get diagnostics allocation_count = row_count;
  if allocation_count = 0 and not exists (select 1 from public.order_stock_allocations a where a.order_id = order_row.id and a.status = 'SETTLED') then raise exception 'ORDER_STOCK_NOT_ALLOCATED'; end if;

  update public.orders
  set status = 'PAID', updated_at = now()
  where id = order_row.id and status in ('HANDED_OFF', 'DELIVERED')
  returning * into order_row;
  return order_row;
end;
$$;

grant execute on function public.settle_order_stock_after_payment(uuid) to authenticated;

create or replace function public.record_cash_payment_and_settle(p_order_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public, private
as $$
declare
  order_row public.orders;
  payment_row public.payments;
  allocation_count integer;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select * into order_row from public.orders where id = p_order_id for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.server_user_id <> auth.uid() then raise exception 'ORDER_SERVER_ONLY'; end if;
  if order_row.status not in ('HANDED_OFF', 'DELIVERED') then raise exception 'ORDER_NOT_READY_FOR_PAYMENT'; end if;
  if exists (select 1 from public.payments p where p.order_id = order_row.id and p.tenant_id = order_row.tenant_id and p.status in ('PAID', 'SUCCESS')) then raise exception 'PAYMENT_ALREADY_RECORDED'; end if;
  if not exists (select 1 from public.order_stock_allocations a where a.order_id = order_row.id and a.status = 'ALLOCATED') then raise exception 'ORDER_STOCK_NOT_ALLOCATED'; end if;

  insert into public.payments (tenant_id, order_id, provider, payment_method, status, amount, currency, paid_at)
  values (order_row.tenant_id, order_row.id, 'CASH', 'CASH', 'PAID', order_row.total_amount, order_row.currency, now())
  returning * into payment_row;

  update public.order_stock_allocations
  set status = 'SETTLED', settled_at = now(), settled_by = auth.uid(), updated_at = now()
  where order_id = order_row.id and status = 'ALLOCATED';
  get diagnostics allocation_count = row_count;
  if allocation_count = 0 then raise exception 'ORDER_STOCK_NOT_ALLOCATED'; end if;

  update public.orders set status = 'PAID', updated_at = now() where id = order_row.id and status in ('HANDED_OFF', 'DELIVERED');
  return payment_row;
end;
$$;

grant execute on function public.record_cash_payment_and_settle(uuid) to authenticated;

commit;
