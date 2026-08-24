-- DebitManager: defense-in-depth RLS for tenant isolation and role permissions.
-- The API remains the primary authorization boundary; these policies prevent direct client writes from bypassing RBAC.
begin;

create schema if not exists private;

create or replace function private.has_tenant_permission(p_tenant_id uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  employee_id uuid;
  employee_position text;
  override_enabled boolean;
  base_allowed boolean := false;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if exists (
    select 1
    from public.companies c
    where c.id = p_tenant_id
      and c.owner_user_id = (select auth.uid())
      and c.deleted_at is null
  ) then
    return true;
  end if;

  select e.id, e.position
    into employee_id, employee_position
  from public.employees e
  where e.tenant_id = p_tenant_id
    and e.user_id = (select auth.uid())
    and e.status = 'ACTIVE'
    and e.deleted_at is null
  limit 1;

  if employee_id is null then
    return false;
  end if;

  base_allowed := case p_permission
    when 'orders.view' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'SECRETAIRE', 'CUISINIER', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'orders.create' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'ADMINISTRATEUR')
    when 'orders.prepare' then employee_position in ('SUPERVISEUR', 'GERANT', 'CUISINIER', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'orders.deliver' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'ADMINISTRATEUR')
    when 'tables.view' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'tables.manage' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'stock.view' then employee_position in ('SUPERVISEUR', 'MAGASINIER', 'GERANT', 'BARMAN', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.adjust' then employee_position in ('MAGASINIER', 'GERANT', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'products.manage' then employee_position in ('GERANT', 'ADMINISTRATEUR')
    when 'team.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'team.manage' then employee_position in ('GERANT', 'ADMINISTRATEUR')
    when 'finance.view' then employee_position in ('GERANT', 'COMPTABLE', 'ADMINISTRATEUR')
    when 'payments.create' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'ADMINISTRATEUR')
    when 'reports.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'COMPTABLE', 'APPROVISIONNEMENT', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'messages.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'messages.send' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'ADMINISTRATEUR')
    else false
  end;

  select ep.enabled
    into override_enabled
  from public.employee_permissions ep
  where ep.employee_id = employee_id
    and ep.tenant_id = p_tenant_id
    and ep.permission_key = p_permission
  limit 1;

  if override_enabled is not null then
    return override_enabled;
  end if;

  return base_allowed;
end;
$$;

revoke execute on function private.has_tenant_permission(uuid, text) from public;
revoke execute on function private.has_tenant_permission(uuid, text) from anon;
grant execute on function private.has_tenant_permission(uuid, text) to authenticated;

-- Companies: employees can read their tenant; only owners can mutate tenant records.
drop policy if exists companies_authenticated_access on public.companies;
drop policy if exists companies_select_authenticated on public.companies;
drop policy if exists companies_insert_owner on public.companies;
drop policy if exists companies_update_owner on public.companies;
drop policy if exists companies_delete_owner on public.companies;
create policy companies_select_authenticated on public.companies
  for select to authenticated
  using (id = private.current_tenant_id() or owner_user_id = (select auth.uid()));
create policy companies_insert_owner on public.companies
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy companies_update_owner on public.companies
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
create policy companies_delete_owner on public.companies
  for delete to authenticated
  using (owner_user_id = (select auth.uid()));

-- Profiles: read is tenant-scoped, but a user can only mutate their own profile row.
drop policy if exists profiles_authenticated_access on public.profiles;
drop policy if exists profiles_select_tenant on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_select_tenant on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or tenant_id = private.current_tenant_id());
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and (tenant_id is null or tenant_id = private.current_tenant_id()));
create policy profiles_delete_self on public.profiles
  for delete to authenticated
  using (id = (select auth.uid()));

-- Employee permissions: staff may read their own effective overrides; only the owner can change overrides.
drop policy if exists employee_permissions_owner_all on public.employee_permissions;
drop policy if exists employee_permissions_select_self_or_owner on public.employee_permissions;
drop policy if exists employee_permissions_insert_owner on public.employee_permissions;
drop policy if exists employee_permissions_update_owner on public.employee_permissions;
drop policy if exists employee_permissions_delete_owner on public.employee_permissions;
create policy employee_permissions_select_self_or_owner on public.employee_permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.id = employee_permissions.employee_id
        and e.user_id = (select auth.uid())
        and e.tenant_id = employee_permissions.tenant_id
    )
    or exists (
      select 1 from public.companies c
      where c.id = employee_permissions.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );
create policy employee_permissions_insert_owner on public.employee_permissions
  for insert to authenticated
  with check (exists (
    select 1 from public.companies c
    where c.id = employee_permissions.tenant_id
      and c.owner_user_id = (select auth.uid())
      and c.deleted_at is null
  ));
create policy employee_permissions_update_owner on public.employee_permissions
  for update to authenticated
  using (exists (
    select 1 from public.companies c
    where c.id = employee_permissions.tenant_id
      and c.owner_user_id = (select auth.uid())
      and c.deleted_at is null
  ))
  with check (exists (
    select 1 from public.companies c
    where c.id = employee_permissions.tenant_id
      and c.owner_user_id = (select auth.uid())
      and c.deleted_at is null
  ));
create policy employee_permissions_delete_owner on public.employee_permissions
  for delete to authenticated
  using (exists (
    select 1 from public.companies c
    where c.id = employee_permissions.tenant_id
      and c.owner_user_id = (select auth.uid())
      and c.deleted_at is null
  ));

-- Employees: any active tenant member can resolve/read the roster; only team managers can mutate it.
drop policy if exists employees_authenticated_access on public.employees;
drop policy if exists employees_select_tenant_member on public.employees;
drop policy if exists employees_insert_manager on public.employees;
drop policy if exists employees_update_manager on public.employees;
drop policy if exists employees_delete_manager on public.employees;
create policy employees_select_tenant_member on public.employees
  for select to authenticated
  using (user_id = (select auth.uid()) or private.has_tenant_permission(tenant_id, 'team.view'));
create policy employees_insert_manager on public.employees
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'team.manage'));
create policy employees_update_manager on public.employees
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'team.manage'))
  with check (private.has_tenant_permission(tenant_id, 'team.manage'));
create policy employees_delete_manager on public.employees
  for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'team.manage'));

-- Catalog: reads are tenant-scoped; mutations require products.manage.
drop policy if exists categories_authenticated_access on public.categories;
create policy categories_select_tenant on public.categories
  for select to authenticated
  using (tenant_id = private.current_tenant_id() or private.has_tenant_permission(tenant_id, 'products.manage'));
create policy categories_insert_manager on public.categories
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'products.manage'));
create policy categories_update_manager on public.categories
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'products.manage'))
  with check (private.has_tenant_permission(tenant_id, 'products.manage'));
create policy categories_delete_manager on public.categories
  for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'products.manage'));

drop policy if exists products_authenticated_access on public.products;
create policy products_select_tenant on public.products
  for select to authenticated
  using (tenant_id = private.current_tenant_id() or private.has_tenant_permission(tenant_id, 'products.manage'));
create policy products_insert_manager on public.products
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'products.manage'));
create policy products_update_manager on public.products
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'products.manage'))
  with check (private.has_tenant_permission(tenant_id, 'products.manage'));
create policy products_delete_manager on public.products
  for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'products.manage'));

-- Stock: reads require stock.view; movements require stock.adjust.
drop policy if exists stock_movements_authenticated_access on public.stock_movements;
create policy stock_movements_select_authorized on public.stock_movements
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.view'));
create policy stock_movements_insert_authorized on public.stock_movements
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'stock.adjust'));
create policy stock_movements_update_authorized on public.stock_movements
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.adjust'))
  with check (private.has_tenant_permission(tenant_id, 'stock.adjust'));
create policy stock_movements_delete_authorized on public.stock_movements
  for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.adjust'));

-- Orders and lines: read/create/prepare/deliver are separated.
drop policy if exists orders_authenticated_access on public.orders;
create policy orders_select_authorized on public.orders
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'orders.view'));
create policy orders_insert_authorized on public.orders
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'orders.create'));
create policy orders_update_authorized on public.orders
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'orders.prepare') or private.has_tenant_permission(tenant_id, 'orders.deliver'))
  with check (
    private.has_tenant_permission(tenant_id, case when status = 'DELIVERED' then 'orders.deliver' else 'orders.prepare' end)
  );
create policy orders_delete_authorized on public.orders
  for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'orders.create'));

drop policy if exists order_items_authenticated_access on public.order_items;
create policy order_items_select_authorized on public.order_items
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'orders.view'));
create policy order_items_insert_authorized on public.order_items
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'orders.create'));
create policy order_items_update_authorized on public.order_items
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'orders.create'))
  with check (private.has_tenant_permission(tenant_id, 'orders.create'));
create policy order_items_delete_authorized on public.order_items
  for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'orders.create'));

-- Payments: finance readers can inspect; payment creators can prepare/update pending records.
drop policy if exists payments_authenticated_access on public.payments;
create policy payments_select_authorized on public.payments
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'finance.view') or private.has_tenant_permission(tenant_id, 'payments.create'));
create policy payments_insert_authorized on public.payments
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'payments.create'));
create policy payments_update_authorized on public.payments
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'payments.create'))
  with check (private.has_tenant_permission(tenant_id, 'payments.create'));

-- Floor plan: view and manage are separate.
drop policy if exists dining_tables_select on public.dining_tables;
drop policy if exists dining_tables_insert on public.dining_tables;
drop policy if exists dining_tables_update on public.dining_tables;
drop policy if exists dining_tables_delete on public.dining_tables;
create policy dining_tables_select on public.dining_tables
  for select to authenticated
  using (deleted_at is null and private.has_tenant_permission(tenant_id, 'tables.view'));
create policy dining_tables_insert on public.dining_tables
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'tables.manage') and deleted_at is null);
create policy dining_tables_update on public.dining_tables
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'tables.manage'))
  with check (private.has_tenant_permission(tenant_id, 'tables.manage'));
create policy dining_tables_delete on public.dining_tables
  for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'tables.manage'));

-- Internal messaging: tenant-scoped, with explicit send/view checks and own-message fallback.
drop policy if exists internal_messages_member_access on public.internal_messages;
drop policy if exists internal_messages_sender_insert on public.internal_messages;
create policy internal_messages_member_access on public.internal_messages
  for select to authenticated
  using (
    private.has_tenant_permission(tenant_id, 'messages.view')
    or sender_user_id = (select auth.uid())
    or recipient_user_id = (select auth.uid())
  );
create policy internal_messages_sender_insert on public.internal_messages
  for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and private.has_tenant_permission(tenant_id, 'messages.send')
  );

commit;
