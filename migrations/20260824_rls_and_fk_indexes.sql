-- DebitManager only: optimize RLS init plans and cover the foreign keys used by tenant-scoped queries.
drop policy if exists companies_authenticated_access on public.companies;
create policy companies_authenticated_access on public.companies
  for all to authenticated
  using ((id = private.current_tenant_id()) or (owner_user_id = (select auth.uid())))
  with check ((owner_user_id = (select auth.uid())) or (id = private.current_tenant_id()));

drop policy if exists profiles_authenticated_access on public.profiles;
create policy profiles_authenticated_access on public.profiles
  for all to authenticated
  using ((id = (select auth.uid())) or (tenant_id = private.current_tenant_id()))
  with check ((id = (select auth.uid())) or (tenant_id = private.current_tenant_id()));

drop policy if exists employee_invitations_owner_all on public.employee_invitations;
create policy employee_invitations_owner_all on public.employee_invitations
  for all to authenticated
  using (tenant_id in (select c.id from public.companies c where c.owner_user_id = (select auth.uid())))
  with check (tenant_id in (select c.id from public.companies c where c.owner_user_id = (select auth.uid())));

drop policy if exists employee_permissions_owner_all on public.employee_permissions;
create policy employee_permissions_owner_all on public.employee_permissions
  for all to authenticated
  using (tenant_id in (select c.id from public.companies c where c.owner_user_id = (select auth.uid())))
  with check (
    tenant_id in (select c.id from public.companies c where c.owner_user_id = (select auth.uid()))
    and exists (select 1 from public.employees e where e.id = employee_permissions.employee_id and e.tenant_id = employee_permissions.tenant_id)
  );

revoke execute on function public.accept_employee_invitation(text) from anon, public;
grant execute on function public.accept_employee_invitation(text) to authenticated;

create index if not exists companies_owner_user_idx on public.companies(owner_user_id);
create index if not exists employee_invitations_invited_by_idx on public.employee_invitations(invited_by);
create index if not exists employee_invitations_accepted_user_idx on public.employee_invitations(accepted_user_id);
create index if not exists employees_user_idx on public.employees(user_id);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);
create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists profiles_tenant_idx on public.profiles(tenant_id);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id);
create index if not exists stock_movements_responsible_user_idx on public.stock_movements(responsible_user_id);
