-- DebitManager: cloisonnement des départements Power dans les politiques Supabase.
begin;

create or replace function private.has_power_activity_access(p_tenant_id uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  position_name text;
begin
  if (select auth.uid()) is null then return false; end if;
  if exists (select 1 from public.companies c where c.id = p_tenant_id and c.owner_user_id = (select auth.uid()) and c.activity_type = 'POWER' and c.deleted_at is null) then return true; end if;
  select e.position into position_name
  from public.employees e
  where e.tenant_id = p_tenant_id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE' and e.deleted_at is null
  limit 1;
  if position_name is null then return false; end if;
  if position_name in ('SUPERVISEUR', 'GERANT', 'GERANT_ADJOINT', 'CAISSIER', 'ADMINISTRATEUR') then return true; end if;
  return case p_permission
    when 'BEVERAGE' then position_name in ('SERVEUR', 'BARMAN', 'MAGASINIER', 'APPROVISIONNEMENT')
    when 'FOOD' then position_name in ('SERVEUR', 'CHEF_CUISINE', 'CUISINIER')
    when 'GYM' then position_name = 'GYM'
    when 'LAUNDRY' then position_name = 'LAVAGE'
    when 'LODGING' then position_name = 'AUBERGE'
    when 'WIFI' then position_name = 'WIFI'
    else false
  end;
end;
$$;
revoke execute on function private.has_power_activity_access(uuid, text) from public;
revoke execute on function private.has_power_activity_access(uuid, text) from anon;
grant execute on function private.has_power_activity_access(uuid, text) to authenticated;

-- Remplacer les politiques trop larges par des politiques liées aux activités de l’utilisateur.
drop policy if exists company_activities_select_authorized on public.company_activities;
create policy company_activities_select_authorized on public.company_activities
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'activities.view') or private.has_power_activity_access(tenant_id, activity_code));
drop policy if exists company_services_select_authorized on public.company_services;
create policy company_services_select_authorized on public.company_services
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'services.view') or exists (select 1 from public.company_activities a where a.id = activity_id and private.has_power_activity_access(a.tenant_id, a.activity_code)));
drop policy if exists lodging_rooms_select_authorized on public.lodging_rooms;
create policy lodging_rooms_select_authorized on public.lodging_rooms
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'power.view') or private.has_power_activity_access(tenant_id, 'LODGING'));
drop policy if exists lodging_stays_select_authorized on public.lodging_stays;
create policy lodging_stays_select_authorized on public.lodging_stays
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'power.view') or private.has_power_activity_access(tenant_id, 'LODGING'));

commit;
