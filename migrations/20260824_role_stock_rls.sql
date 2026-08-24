-- DebitManager: synchroniser la fonction RLS avec le catalogue RBAC des stocks et du contrôle journalier.
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
  if (select auth.uid()) is null then return false; end if;

  if exists (
    select 1 from public.companies c
    where c.id = p_tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null
  ) then return true; end if;

  select e.id, e.position into employee_id, employee_position
  from public.employees e
  where e.tenant_id = p_tenant_id and e.user_id = (select auth.uid())
    and e.status = 'ACTIVE' and e.deleted_at is null
  limit 1;

  if employee_id is null then return false; end if;

  base_allowed := case p_permission
    when 'orders.view' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'SECRETAIRE', 'CUISINIER', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'orders.create' then employee_position in ('SERVEUR', 'GERANT', 'BARMAN', 'ADMINISTRATEUR')
    when 'orders.prepare' then employee_position in ('GERANT', 'CUISINIER', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'orders.deliver' then employee_position in ('SERVEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'orders.handoff' then employee_position in ('GERANT', 'ADMINISTRATEUR')
    when 'tables.view' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'tables.manage' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'stock.view' then employee_position in ('SUPERVISEUR', 'MAGASINIER', 'GERANT', 'BARMAN', 'APPROVISIONNEMENT', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'stock.receive' then employee_position in ('MAGASINIER', 'GERANT', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.issue' then employee_position in ('MAGASINIER', 'GERANT', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.adjust' then employee_position in ('GERANT', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.handoff' then employee_position in ('MAGASINIER', 'GERANT', 'ADMINISTRATEUR')
    when 'stock.accept_kitchen' then employee_position in ('CHEF_CUISINE', 'GERANT', 'ADMINISTRATEUR')
    when 'stock.audit' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'products.manage' then employee_position in ('GERANT', 'ADMINISTRATEUR')
    when 'team.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'team.manage' then employee_position in ('GERANT', 'ADMINISTRATEUR')
    when 'finance.view' then employee_position in ('GERANT', 'COMPTABLE', 'ADMINISTRATEUR')
    when 'payments.create' then employee_position in ('SERVEUR', 'GERANT', 'BARMAN', 'ADMINISTRATEUR')
    when 'reports.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'COMPTABLE', 'APPROVISIONNEMENT', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'reports.daily_close' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'messages.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'messages.send' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    else false
  end;

  select ep.enabled into override_enabled from public.employee_permissions ep
  where ep.employee_id = employee_id and ep.tenant_id = p_tenant_id and ep.permission_key = p_permission limit 1;
  if override_enabled is not null then return override_enabled; end if;
  return base_allowed;
end;
$$;

revoke execute on function private.has_tenant_permission(uuid, text) from public;
revoke execute on function private.has_tenant_permission(uuid, text) from anon;
grant execute on function private.has_tenant_permission(uuid, text) to authenticated;
