-- DebitManager only: harden tenant policies for project plelharwnppmekntpiqi.
-- No EAM objects are referenced.

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
    and deleted_at is null
  limit 1;
$$;

revoke execute on function public.current_tenant_id() from public;
revoke execute on function public.current_tenant_id() from anon;
grant execute on function public.current_tenant_id() to authenticated;

alter table public.companies enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists companies_tenant_access on public.companies;
create policy companies_authenticated_access on public.companies
  for all to authenticated
  using (id = public.current_tenant_id() or owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() or id = public.current_tenant_id());

drop policy if exists categories_tenant_access on public.categories;
create policy categories_authenticated_access on public.categories
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists products_tenant_access on public.products;
create policy products_authenticated_access on public.products
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists stock_movements_tenant_access on public.stock_movements;
create policy stock_movements_authenticated_access on public.stock_movements
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists orders_tenant_access on public.orders;
create policy orders_authenticated_access on public.orders
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists order_items_tenant_access on public.order_items;
create policy order_items_authenticated_access on public.order_items
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
