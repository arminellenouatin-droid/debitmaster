-- DebitManager: seuls les Serveurs/Serveuses créent les commandes.
-- Le Gérant et la cuisine peuvent préparer les lignes et les marquer READY.
-- Les Serveurs/Serveuses peuvent faire évoluer une ligne reçue vers DELIVERED.

create or replace function private.has_tenant_permission(p_tenant_id uuid, p_permission text)
returns boolean
language plpgsql
stable security definer
set search_path to public, private
as $function$
declare
  v_employee_id uuid;
  v_employee_position text;
  v_override_enabled boolean;
  v_base_allowed boolean := false;
begin
  if (select auth.uid()) is null then return false; end if;

  if exists (
    select 1
    from public.companies c
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
    when 'orders.deliver' then v_employee_position in ('SERVEUR', 'SUPERVISEUR', 'BARMAN', 'ADMINISTRATEUR')
    when 'tables.view' then v_employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'tables.manage' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'stock.view' then v_employee_position in ('SUPERVISEUR', 'MAGASINIER', 'GERANT', 'BARMAN', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.receive' then v_employee_position in ('MAGASINIER', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.issue' then v_employee_position in ('APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.adjust' then v_employee_position in ('MAGASINIER', 'GERANT', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.handoff' then v_employee_position in ('MAGASINIER', 'ADMINISTRATEUR')
    when 'stock.accept_counter' then v_employee_position in ('GERANT', 'ADMINISTRATEUR')
    when 'products.manage' then v_employee_position in ('MAGASINIER', 'GERANT', 'ADMINISTRATEUR')
    when 'team.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'team.manage' then v_employee_position in ('GERANT', 'ADMINISTRATEUR')
    when 'finance.view' then v_employee_position in ('GERANT', 'COMPTABLE', 'ADMINISTRATEUR')
    when 'payments.create' then v_employee_position in ('SERVEUR', 'SUPERVISEUR', 'BARMAN', 'ADMINISTRATEUR')
    when 'reports.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'COMPTABLE', 'APPROVISIONNEMENT', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'messages.view' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'messages.send' then v_employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'ADMINISTRATEUR')
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
$function$;

drop policy if exists order_items_update_authorized on public.order_items;
create policy order_items_update_authorized on public.order_items
  for update to authenticated
  using (
    private.has_tenant_permission(tenant_id, 'orders.prepare')
    or private.has_tenant_permission(tenant_id, 'orders.deliver')
  )
  with check (
    private.has_tenant_permission(tenant_id, 'orders.prepare')
    or private.has_tenant_permission(tenant_id, 'orders.deliver')
  );
