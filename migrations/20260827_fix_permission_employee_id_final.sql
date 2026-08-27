-- DebitManager: correction définitive de l'ambiguïté employee_id dans les politiques RLS.
-- La matrice inclut les droits Power nécessaires au Superviseur pour catalogue et stock.
begin;

create or replace function private.has_tenant_permission(p_tenant_id uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_employee_id uuid;
  v_employee_position text;
  v_override_enabled boolean;
  v_base_allowed boolean := false;
begin
  if (select auth.uid()) is null then return false; end if;

  if exists (
    select 1 from public.companies c
    where c.id = p_tenant_id
      and c.owner_user_id = (select auth.uid())
      and c.deleted_at is null
  ) then return true; end if;

  select e.id, e.position
    into v_employee_id, v_employee_position
  from public.employees e
  where e.tenant_id = p_tenant_id
    and e.user_id = (select auth.uid())
    and e.status = 'ACTIVE'
    and e.deleted_at is null
  limit 1;

  if v_employee_id is null then return false; end if;

  v_base_allowed := case p_permission
    when 'orders.view' then v_employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'SECRETAIRE', 'CUISINIER', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'orders.create' then v_employee_position in ('SERVEUR', 'BARMAN', 'ADMINISTRATEUR')
    when 'orders.prepare' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'CUISINIER', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'orders.deliver' then v_employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'ADMINISTRATEUR')
    when 'orders.receive' then v_employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'orders.handoff' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'tables.view' then v_employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'tables.manage' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'stock.view' then v_employee_position in ('SUPERVISEUR', 'MAGASINIER', 'GERANT', 'BARMAN', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.receive' then v_employee_position in ('SUPERVISEUR', 'MAGASINIER', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.issue' then v_employee_position in ('SUPERVISEUR', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.adjust' then v_employee_position in ('SUPERVISEUR', 'MAGASINIER', 'GERANT', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.handoff' then v_employee_position in ('SUPERVISEUR', 'MAGASINIER', 'ADMINISTRATEUR')
    when 'stock.accept_counter' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'stock.accept_kitchen' then v_employee_position in ('SUPERVISEUR', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'stock.audit' then v_employee_position in ('SUPERVISEUR', 'ADMINISTRATEUR')
    when 'products.manage' then v_employee_position in ('SUPERVISEUR', 'MAGASINIER', 'GERANT', 'ADMINISTRATEUR')
    when 'team.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'team.manage' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'team.salary.manage' then v_employee_position in ('SUPERVISEUR', 'ADMINISTRATEUR')
    when 'finance.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'COMPTABLE', 'ADMINISTRATEUR')
    when 'payments.create' then v_employee_position in ('SERVEUR', 'SUPERVISEUR', 'BARMAN', 'ADMINISTRATEUR')
    when 'reports.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'COMPTABLE', 'APPROVISIONNEMENT', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'reports.daily_close' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'messages.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'messages.send' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'ADMINISTRATEUR')
    when 'activities.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'activities.manage' then v_employee_position in ('SUPERVISEUR', 'ADMINISTRATEUR')
    when 'services.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SERVEUR', 'BARMAN', 'ADMINISTRATEUR')
    when 'services.manage' then v_employee_position in ('SUPERVISEUR', 'ADMINISTRATEUR')
    when 'power.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SERVEUR', 'BARMAN', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    else false
  end;

  select ep.enabled
    into v_override_enabled
  from public.employee_permissions ep
  where ep.employee_id = v_employee_id
    and ep.tenant_id = p_tenant_id
    and ep.permission_key = p_permission
  limit 1;

  if v_override_enabled is not null then return v_override_enabled; end if;
  return v_base_allowed;
end;
$$;

revoke execute on function private.has_tenant_permission(uuid, text) from public;
revoke execute on function private.has_tenant_permission(uuid, text) from anon;
grant execute on function private.has_tenant_permission(uuid, text) to authenticated;

commit;
