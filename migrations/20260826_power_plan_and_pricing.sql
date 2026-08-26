-- DebitManager: plan Power réservé aux établissements multi-activités.
-- Les données métier restent XOF ; le plan Power est identifié par companies.activity_type = POWER.
begin;

alter table public.employees
  add column if not exists salary_amount integer,
  add column if not exists salary_currency text not null default 'XOF',
  add column if not exists salary_frequency text not null default 'MONTHLY';

alter table public.employees
  drop constraint if exists employees_salary_amount_check;
alter table public.employees
  add constraint employees_salary_amount_check
  check (salary_amount is null or salary_amount >= 0);

alter table public.employees
  drop constraint if exists employees_salary_currency_check;
alter table public.employees
  add constraint employees_salary_currency_check
  check (salary_currency in ('XOF'));

alter table public.employees
  drop constraint if exists employees_salary_frequency_check;
alter table public.employees
  add constraint employees_salary_frequency_check
  check (salary_frequency in ('MONTHLY', 'WEEKLY', 'DAILY'));

create table if not exists public.saas_plan_prices (
  id uuid primary key default gen_random_uuid(),
  activity_code text not null check (activity_code in ('BAR', 'BAR_RESTAURANT', 'NIGHTCLUB_LOUNGE', 'POWER')),
  plan_code text not null check (plan_code in ('BASE', 'MOYENNE', 'SEMESTRIELLE', 'SUPREME')),
  price_xof integer not null check (price_xof > 0),
  description text not null default '',
  is_active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_code, plan_code)
);

insert into public.saas_plan_prices (activity_code, plan_code, price_xof, description)
values
  ('BAR', 'BASE', 50000, 'Paiement mensuel.'),
  ('BAR', 'MOYENNE', 130000, 'Paiement de trois mois avec réduction.'),
  ('BAR', 'SEMESTRIELLE', 240000, 'Paiement de six mois avec réduction.'),
  ('BAR', 'SUPREME', 400000, 'Paiement de douze mois avec réduction.'),
  ('BAR_RESTAURANT', 'BASE', 75000, 'Paiement mensuel.'),
  ('BAR_RESTAURANT', 'MOYENNE', 195000, 'Paiement de trois mois avec réduction.'),
  ('BAR_RESTAURANT', 'SEMESTRIELLE', 360000, 'Paiement de six mois avec réduction.'),
  ('BAR_RESTAURANT', 'SUPREME', 600000, 'Paiement de douze mois avec réduction.'),
  ('NIGHTCLUB_LOUNGE', 'BASE', 100000, 'Paiement mensuel.'),
  ('NIGHTCLUB_LOUNGE', 'MOYENNE', 260000, 'Paiement de trois mois avec réduction.'),
  ('NIGHTCLUB_LOUNGE', 'SEMESTRIELLE', 480000, 'Paiement de six mois avec réduction.'),
  ('NIGHTCLUB_LOUNGE', 'SUPREME', 800000, 'Paiement de douze mois avec réduction.'),
  ('POWER', 'BASE', 150000, 'Paiement mensuel du plan Power.'),
  ('POWER', 'MOYENNE', 390000, 'Paiement de trois mois avec réduction.'),
  ('POWER', 'SEMESTRIELLE', 720000, 'Paiement de six mois avec réduction.'),
  ('POWER', 'SUPREME', 1200000, 'Paiement de douze mois avec réduction.')
on conflict (activity_code, plan_code) do nothing;

create table if not exists public.company_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  activity_code text not null check (activity_code in ('BEVERAGE', 'FOOD', 'GYM', 'LAUNDRY', 'LODGING', 'WIFI')),
  name varchar(120) not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, activity_code),
  unique (tenant_id, name)
);
create index if not exists company_activities_tenant_idx on public.company_activities (tenant_id, is_active);

create table if not exists public.company_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  activity_id uuid not null references public.company_activities(id) on delete cascade,
  name varchar(160) not null,
  description text,
  price_xof integer not null default 0 check (price_xof >= 0),
  billing_unit varchar(40) not null default 'UNIT',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, activity_id, name)
);
create index if not exists company_services_tenant_activity_idx on public.company_services (tenant_id, activity_id, is_active);

create table if not exists public.employee_activity_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  activity_id uuid not null references public.company_activities(id) on delete cascade,
  team_label varchar(120),
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (employee_id, activity_id)
);
create index if not exists employee_activity_assignments_tenant_idx on public.employee_activity_assignments (tenant_id, activity_id, is_active);

create table if not exists public.lodging_rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  room_code varchar(40) not null,
  label varchar(120) not null,
  nightly_price_xof integer not null default 0 check (nightly_price_xof >= 0),
  pass_price_xof integer not null default 0 check (pass_price_xof >= 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, room_code)
);
create index if not exists lodging_rooms_tenant_status_idx on public.lodging_rooms (tenant_id, status);

create table if not exists public.lodging_stays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  room_id uuid not null references public.lodging_rooms(id) on delete restrict,
  customer_name varchar(160) not null,
  customer_phone varchar(40),
  stay_type text not null check (stay_type in ('NIGHT', 'PASS')),
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  amount_xof integer not null check (amount_xof >= 0),
  payment_status text not null default 'PENDING' check (payment_status in ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED')),
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED', 'CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lodging_stays_tenant_date_idx on public.lodging_stays (tenant_id, check_in_at desc);

alter table public.payments
  add column if not exists activity_code text;
alter table public.payments
  drop constraint if exists payments_activity_code_check;
alter table public.payments
  add constraint payments_activity_code_check
  check (activity_code is null or activity_code in ('BEVERAGE', 'FOOD', 'GYM', 'LAUNDRY', 'LODGING', 'WIFI'));
create index if not exists payments_tenant_activity_idx on public.payments (tenant_id, activity_code, created_at desc);

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
  where e.tenant_id = p_tenant_id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE' and e.deleted_at is null
  limit 1;
  if employee_id is null then return false; end if;

  base_allowed := case p_permission
    when 'orders.view' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'SECRETAIRE', 'CUISINIER', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'orders.create' then employee_position in ('SERVEUR', 'BARMAN', 'ADMINISTRATEUR')
    when 'orders.prepare' then employee_position in ('SUPERVISEUR', 'GERANT', 'CUISINIER', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'orders.deliver' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'BARMAN', 'ADMINISTRATEUR')
    when 'orders.receive' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'orders.handoff' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'tables.view' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'GERANT', 'BARMAN', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'tables.manage' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'stock.view' then employee_position in ('SUPERVISEUR', 'MAGASINIER', 'GERANT', 'BARMAN', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.receive' then employee_position in ('SUPERVISEUR', 'MAGASINIER', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.issue' then employee_position in ('SUPERVISEUR', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.adjust' then employee_position in ('SUPERVISEUR', 'MAGASINIER', 'GERANT', 'APPROVISIONNEMENT', 'ADMINISTRATEUR')
    when 'stock.handoff' then employee_position in ('SUPERVISEUR', 'MAGASINIER', 'ADMINISTRATEUR')
    when 'stock.accept_counter' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'stock.accept_kitchen' then employee_position in ('SUPERVISEUR', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'stock.audit' then employee_position in ('SUPERVISEUR', 'ADMINISTRATEUR')
    when 'products.manage' then employee_position in ('SUPERVISEUR', 'MAGASINIER', 'GERANT', 'ADMINISTRATEUR')
    when 'team.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'team.manage' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'team.salary.manage' then employee_position in ('SUPERVISEUR', 'ADMINISTRATEUR')
    when 'finance.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'COMPTABLE', 'ADMINISTRATEUR')
    when 'payments.create' then employee_position in ('SERVEUR', 'SUPERVISEUR', 'BARMAN', 'ADMINISTRATEUR')
    when 'reports.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'COMPTABLE', 'APPROVISIONNEMENT', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'reports.daily_close' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'messages.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    when 'messages.send' then employee_position in ('SUPERVISEUR', 'GERANT', 'SECRETAIRE', 'ADMINISTRATEUR')
    when 'activities.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'ADMINISTRATEUR')
    when 'activities.manage' then employee_position in ('SUPERVISEUR', 'ADMINISTRATEUR')
    when 'services.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SERVEUR', 'BARMAN', 'ADMINISTRATEUR')
    when 'services.manage' then employee_position in ('SUPERVISEUR', 'ADMINISTRATEUR')
    when 'power.view' then employee_position in ('SUPERVISEUR', 'GERANT', 'SERVEUR', 'BARMAN', 'CHEF_CUISINE', 'ADMINISTRATEUR')
    else false
  end;

  select ep.enabled into override_enabled
  from public.employee_permissions ep
  where ep.employee_id = employee_id and ep.tenant_id = p_tenant_id and ep.permission_key = p_permission
  limit 1;
  if override_enabled is not null then return override_enabled; end if;
  return base_allowed;
end;
$$;

revoke execute on function private.has_tenant_permission(uuid, text) from public;
revoke execute on function private.has_tenant_permission(uuid, text) from anon;
grant execute on function private.has_tenant_permission(uuid, text) to authenticated;

alter table public.saas_plan_prices enable row level security;
drop policy if exists saas_plan_prices_select_authenticated on public.saas_plan_prices;
create policy saas_plan_prices_select_authenticated on public.saas_plan_prices
  for select to authenticated using (true);
drop policy if exists saas_plan_prices_admin_insert on public.saas_plan_prices;
create policy saas_plan_prices_admin_insert on public.saas_plan_prices
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type = 'SUPER_ADMIN' and p.role = 'MASTER_ADMIN' and p.status = 'ACTIVE'));
drop policy if exists saas_plan_prices_admin_update on public.saas_plan_prices;
create policy saas_plan_prices_admin_update on public.saas_plan_prices
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type = 'SUPER_ADMIN' and p.role = 'MASTER_ADMIN' and p.status = 'ACTIVE'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type = 'SUPER_ADMIN' and p.role = 'MASTER_ADMIN' and p.status = 'ACTIVE'));

alter table public.company_activities enable row level security;
drop policy if exists company_activities_select_authorized on public.company_activities;
create policy company_activities_select_authorized on public.company_activities
  for select to authenticated using (private.has_tenant_permission(tenant_id, 'activities.view'));
drop policy if exists company_activities_insert_authorized on public.company_activities;
create policy company_activities_insert_authorized on public.company_activities
  for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'activities.manage'));
drop policy if exists company_activities_update_authorized on public.company_activities;
create policy company_activities_update_authorized on public.company_activities
  for update to authenticated using (private.has_tenant_permission(tenant_id, 'activities.manage')) with check (private.has_tenant_permission(tenant_id, 'activities.manage'));

alter table public.company_services enable row level security;
drop policy if exists company_services_select_authorized on public.company_services;
create policy company_services_select_authorized on public.company_services
  for select to authenticated using (private.has_tenant_permission(tenant_id, 'services.view'));
drop policy if exists company_services_insert_authorized on public.company_services;
create policy company_services_insert_authorized on public.company_services
  for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'services.manage'));
drop policy if exists company_services_update_authorized on public.company_services;
create policy company_services_update_authorized on public.company_services
  for update to authenticated using (private.has_tenant_permission(tenant_id, 'services.manage')) with check (private.has_tenant_permission(tenant_id, 'services.manage'));

alter table public.employee_activity_assignments enable row level security;
drop policy if exists employee_activity_assignments_select_authorized on public.employee_activity_assignments;
create policy employee_activity_assignments_select_authorized on public.employee_activity_assignments
  for select to authenticated using (private.has_tenant_permission(tenant_id, 'team.view'));
drop policy if exists employee_activity_assignments_manage_authorized on public.employee_activity_assignments;
create policy employee_activity_assignments_manage_authorized on public.employee_activity_assignments
  for all to authenticated using (private.has_tenant_permission(tenant_id, 'team.manage')) with check (private.has_tenant_permission(tenant_id, 'team.manage'));

alter table public.lodging_rooms enable row level security;
drop policy if exists lodging_rooms_select_authorized on public.lodging_rooms;
create policy lodging_rooms_select_authorized on public.lodging_rooms
  for select to authenticated using (private.has_tenant_permission(tenant_id, 'power.view'));
drop policy if exists lodging_rooms_manage_authorized on public.lodging_rooms;
create policy lodging_rooms_manage_authorized on public.lodging_rooms
  for all to authenticated using (private.has_tenant_permission(tenant_id, 'activities.manage')) with check (private.has_tenant_permission(tenant_id, 'activities.manage'));

alter table public.lodging_stays enable row level security;
drop policy if exists lodging_stays_select_authorized on public.lodging_stays;
create policy lodging_stays_select_authorized on public.lodging_stays
  for select to authenticated using (private.has_tenant_permission(tenant_id, 'power.view'));
drop policy if exists lodging_stays_manage_authorized on public.lodging_stays;
create policy lodging_stays_manage_authorized on public.lodging_stays
  for all to authenticated using (private.has_tenant_permission(tenant_id, 'payments.create')) with check (private.has_tenant_permission(tenant_id, 'payments.create'));

commit;
