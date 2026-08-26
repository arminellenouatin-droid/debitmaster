-- DebitManager Power service operations: no stock is involved for Gym, Laundry and Lodging.
create table if not exists public.power_service_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  activity_code text not null check (activity_code in ('GYM','LAUNDRY','LODGING','WIFI')),
  service_id uuid references public.company_services(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name varchar(160) not null,
  room_id uuid references public.lodging_rooms(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_xof integer not null check (unit_price_xof >= 0),
  total_amount_xof integer generated always as (quantity * unit_price_xof) stored,
  payment_method text not null default 'CASH' check (payment_method in ('CASH','MOBILE_MONEY')),
  payment_status text not null default 'PAID' check (payment_status in ('PENDING','PAID','CANCELLED')),
  membership_expires_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists power_service_sales_tenant_activity_idx on public.power_service_sales (tenant_id, activity_code, created_at desc);

create table if not exists public.power_cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  activity_code text not null check (activity_code in ('GYM','LAUNDRY','LODGING','WIFI')),
  sale_id uuid references public.power_service_sales(id) on delete set null,
  movement_type text not null check (movement_type in ('SALE','REVERSAL','SETTLEMENT')),
  amount_xof integer not null check (amount_xof >= 0),
  note varchar(500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists power_cash_movements_tenant_activity_idx on public.power_cash_movements (tenant_id, activity_code, created_at desc);

alter table public.power_service_sales enable row level security;
alter table public.power_cash_movements enable row level security;
drop policy if exists power_service_sales_select on public.power_service_sales;
create policy power_service_sales_select on public.power_service_sales for select to authenticated using (private.has_tenant_permission(tenant_id, 'services.view'));
drop policy if exists power_service_sales_insert on public.power_service_sales;
create policy power_service_sales_insert on public.power_service_sales for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'services.manage') or private.has_tenant_permission(tenant_id, 'payments.create'));
drop policy if exists power_cash_movements_select on public.power_cash_movements;
create policy power_cash_movements_select on public.power_cash_movements for select to authenticated using (private.has_tenant_permission(tenant_id, 'finance.view') or private.has_tenant_permission(tenant_id, 'services.view'));
drop policy if exists power_cash_movements_insert on public.power_cash_movements;
create policy power_cash_movements_insert on public.power_cash_movements for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'payments.create'));

create or replace function private.has_tenant_permission(p_tenant_id uuid, p_permission text)
returns boolean language plpgsql stable security definer set search_path = public, private as $$
declare employee_id uuid; employee_position text; override_enabled boolean; base_allowed boolean := false;
begin
  if (select auth.uid()) is null then return false; end if;
  if exists (select 1 from public.companies c where c.id = p_tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null) then return true; end if;
  select e.id, e.position into employee_id, employee_position from public.employees e where e.tenant_id = p_tenant_id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE' and e.deleted_at is null limit 1;
  if employee_id is null then return false; end if;
  base_allowed := case p_permission
    when 'orders.view' then employee_position in ('SERVEUR','SUPERVISEUR','GERANT','BARMAN','SECRETAIRE','CUISINIER','CHEF_CUISINE','ADMINISTRATEUR')
    when 'orders.create' then employee_position in ('SERVEUR','BARMAN','ADMINISTRATEUR')
    when 'orders.prepare' then employee_position in ('SUPERVISEUR','GERANT','CUISINIER','CHEF_CUISINE','ADMINISTRATEUR')
    when 'orders.deliver' then employee_position in ('SERVEUR','SUPERVISEUR','BARMAN','ADMINISTRATEUR')
    when 'orders.receive' then employee_position in ('SERVEUR','SUPERVISEUR','GERANT','ADMINISTRATEUR')
    when 'orders.handoff' then employee_position in ('SUPERVISEUR','GERANT','ADMINISTRATEUR')
    when 'tables.view' then employee_position in ('SERVEUR','SUPERVISEUR','GERANT','BARMAN','SECRETAIRE','CHEF_CUISINE','ADMINISTRATEUR')
    when 'tables.manage' then employee_position in ('SUPERVISEUR','GERANT','ADMINISTRATEUR')
    when 'stock.view' then employee_position in ('SUPERVISEUR','MAGASINIER','GERANT','BARMAN','APPROVISIONNEMENT','ADMINISTRATEUR')
    when 'stock.receive' then employee_position in ('SUPERVISEUR','MAGASINIER','APPROVISIONNEMENT','ADMINISTRATEUR')
    when 'stock.issue' then employee_position in ('SUPERVISEUR','APPROVISIONNEMENT','ADMINISTRATEUR')
    when 'stock.adjust' then employee_position in ('SUPERVISEUR','MAGASINIER','GERANT','APPROVISIONNEMENT','ADMINISTRATEUR')
    when 'stock.handoff' then employee_position in ('SUPERVISEUR','MAGASINIER','ADMINISTRATEUR')
    when 'stock.accept_counter' then employee_position in ('SUPERVISEUR','GERANT','ADMINISTRATEUR')
    when 'stock.accept_kitchen' then employee_position in ('SUPERVISEUR','CHEF_CUISINE','ADMINISTRATEUR')
    when 'stock.audit' then employee_position in ('SUPERVISEUR','ADMINISTRATEUR')
    when 'products.manage' then employee_position in ('SUPERVISEUR','MAGASINIER','GERANT','ADMINISTRATEUR')
    when 'team.view' then employee_position in ('SUPERVISEUR','GERANT','SECRETAIRE','CHEF_CUISINE','ADMINISTRATEUR')
    when 'team.manage' then employee_position in ('SUPERVISEUR','GERANT','ADMINISTRATEUR')
    when 'team.salary.manage' then employee_position in ('SUPERVISEUR','ADMINISTRATEUR')
    when 'finance.view' then employee_position in ('SUPERVISEUR','GERANT','COMPTABLE','GYM','AUBERGE','LAVAGE','WIFI','ADMINISTRATEUR')
    when 'payments.create' then employee_position in ('SERVEUR','SUPERVISEUR','BARMAN','SECRETAIRE','GYM','AUBERGE','LAVAGE','WIFI','ADMINISTRATEUR')
    when 'reports.view' then employee_position in ('SUPERVISEUR','GERANT','SECRETAIRE','COMPTABLE','APPROVISIONNEMENT','CHEF_CUISINE','GYM','AUBERGE','LAVAGE','WIFI','ADMINISTRATEUR')
    when 'reports.daily_close' then employee_position in ('SUPERVISEUR','GERANT','ADMINISTRATEUR')
    when 'messages.view' then employee_position in ('SUPERVISEUR','GERANT','SECRETAIRE','CHEF_CUISINE','ADMINISTRATEUR')
    when 'messages.send' then employee_position in ('SUPERVISEUR','GERANT','SECRETAIRE','ADMINISTRATEUR')
    when 'activities.view' then employee_position in ('SUPERVISEUR','GERANT','ADMINISTRATEUR')
    when 'activities.manage' then employee_position in ('SUPERVISEUR','ADMINISTRATEUR')
    when 'services.view' then employee_position in ('SUPERVISEUR','GERANT','SERVEUR','BARMAN','SECRETAIRE','GYM','AUBERGE','LAVAGE','WIFI','ADMINISTRATEUR')
    when 'services.manage' then employee_position in ('SUPERVISEUR','ADMINISTRATEUR')
    when 'power.view' then employee_position in ('SUPERVISEUR','GERANT','SERVEUR','BARMAN','CHEF_CUISINE','SECRETAIRE','GYM','AUBERGE','LAVAGE','WIFI','ADMINISTRATEUR')
    else false
  end;
  select ep.enabled into override_enabled from public.employee_permissions ep where ep.employee_id = employee_id and ep.tenant_id = p_tenant_id and ep.permission_key = p_permission limit 1;
  if override_enabled is not null then return override_enabled; end if;
  return base_allowed;
end; $$;
