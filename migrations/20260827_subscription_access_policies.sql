-- DebitManager: les politiques qui contournaient has_tenant_permission doivent aussi respecter l’abonnement.
begin;

create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select p.tenant_id
  from public.profiles p
  where p.id = auth.uid()
    and p.deleted_at is null
    and p.tenant_id is not null
    and private.has_tenant_subscription_access(p.tenant_id)
  limit 1;
$$;

-- Tables : un propriétaire conserve la gestion uniquement tant que le SaaS est actif.
drop policy if exists dining_tables_select on public.dining_tables;
create policy dining_tables_select on public.dining_tables
  for select to authenticated
  using (
    deleted_at is null
    and private.has_tenant_subscription_access(tenant_id)
    and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = dining_tables.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null))
  );

drop policy if exists dining_tables_insert on public.dining_tables;
create policy dining_tables_insert on public.dining_tables
  for insert to authenticated
  with check (
    deleted_at is null
    and private.has_tenant_subscription_access(tenant_id)
    and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = dining_tables.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null))
  );

drop policy if exists dining_tables_update on public.dining_tables;
create policy dining_tables_update on public.dining_tables
  for update to authenticated
  using (private.has_tenant_subscription_access(tenant_id) and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = dining_tables.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)))
  with check (private.has_tenant_subscription_access(tenant_id) and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = dining_tables.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)));

-- Zones et affectations : conserver la visibilité des zones actives seulement pour un tenant valide.
drop policy if exists work_zones_select on public.work_zones;
create policy work_zones_select on public.work_zones
  for select to authenticated
  using (is_active and private.has_tenant_subscription_access(tenant_id) and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = work_zones.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)));

drop policy if exists work_zones_insert on public.work_zones;
create policy work_zones_insert on public.work_zones
  for insert to authenticated
  with check (private.has_tenant_subscription_access(tenant_id) and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = work_zones.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)));

drop policy if exists work_zones_update on public.work_zones;
create policy work_zones_update on public.work_zones
  for update to authenticated
  using (private.has_tenant_subscription_access(tenant_id) and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = work_zones.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)))
  with check (private.has_tenant_subscription_access(tenant_id) and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = work_zones.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)));

drop policy if exists employee_zone_assignments_select on public.employee_zone_assignments;
create policy employee_zone_assignments_select on public.employee_zone_assignments
  for select to authenticated
  using (private.has_tenant_subscription_access(tenant_id) and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = employee_zone_assignments.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)));

drop policy if exists employee_zone_assignments_insert on public.employee_zone_assignments;
create policy employee_zone_assignments_insert on public.employee_zone_assignments
  for insert to authenticated
  with check (private.has_tenant_subscription_access(tenant_id) and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = employee_zone_assignments.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)));

drop policy if exists employee_zone_assignments_delete on public.employee_zone_assignments;
create policy employee_zone_assignments_delete on public.employee_zone_assignments
  for delete to authenticated
  using (private.has_tenant_subscription_access(tenant_id) and (tenant_id = private.current_tenant_id() or exists (select 1 from public.companies c where c.id = employee_zone_assignments.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)));

commit;
