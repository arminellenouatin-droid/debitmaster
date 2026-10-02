-- DebitMaster: Sprint 10 pour l'activité « Atelier de couture ».
-- Personnel : horaires, présence géolocalisée (déconnexion > 15min), paie mensuelle, points, primes et classements.
begin;

-- 1. Table des Horaires de Travail
create table if not exists public.couture_work_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid references public.couture_sites(id) on delete cascade,
  staff_category text not null check (staff_category in ('BOUTIQUE', 'ADMIN', 'ATELIER')),
  day_of_week integer not null check (day_of_week between 0 and 6),
  morning_start_time text,
  morning_end_time text,
  afternoon_start_time text,
  afternoon_end_time text,
  evening_start_time text,
  evening_end_time text,
  is_day_off boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, site_id, staff_category, day_of_week),
  unique (id, tenant_id)
);

create index if not exists couture_schedules_tenant_idx
  on public.couture_work_schedules (tenant_id, site_id, staff_category);

-- 2. Table des Pointages et Présences Géolocalisées
create table if not exists public.couture_attendance_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  employee_id uuid not null references public.couture_employees(id) on delete cascade,
  site_id uuid references public.couture_sites(id) on delete set null,
  log_date date not null default current_date,
  check_in_time timestamptz,
  check_out_time timestamptz,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  distance_from_site_meters integer,
  status text not null default 'ON_SITE' check (status in ('ON_SITE', 'LATE', 'ABSENT', 'OFF_SITE', 'AUTHORIZED_LEAVE')),
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists couture_attendance_tenant_emp_idx
  on public.couture_attendance_logs (tenant_id, employee_id, log_date);

-- 3. Table des Incidents de Présence (éloignement > 15min, hors zone)
create table if not exists public.couture_attendance_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  employee_id uuid not null references public.couture_employees(id) on delete cascade,
  site_id uuid references public.couture_sites(id) on delete set null,
  incident_type text not null check (incident_type in ('AWAY_OVER_15_MIN', 'LOCATION_MISMATCH', 'UNAUTHORIZED_LEAVE')),
  away_minutes integer not null default 0,
  description text,
  resolved boolean not null default false,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists couture_incidents_tenant_idx
  on public.couture_attendance_incidents (tenant_id, resolved, created_at desc);

-- 4. Table de Paie Mensuelle (Personnel Boutique et Administratif)
create table if not exists public.couture_monthly_payrolls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  employee_id uuid not null references public.couture_employees(id) on delete cascade,
  payroll_number text not null check (payroll_number ~ '^PAY-[0-9]{4}-[0-9]{6}$'),
  period_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  base_salary bigint not null default 0 check (base_salary >= 0),
  primes_amount bigint not null default 0 check (primes_amount >= 0),
  deductions_amount bigint not null default 0 check (deductions_amount >= 0),
  net_pay bigint not null default 0 check (net_pay >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'PAID')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, payroll_number),
  unique (tenant_id, employee_id, period_year, period_month),
  unique (id, tenant_id)
);

create index if not exists couture_monthly_payrolls_period_idx
  on public.couture_monthly_payrolls (tenant_id, period_year, period_month, status);

-- 5. Table de Configuration des Primes et Points Vendeurs
create table if not exists public.couture_sales_incentives_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  points_per_step_xof integer not null default 50000,
  weekly_top_seller_bonus_xof integer not null default 10000,
  monthly_top_seller_bonus_xof integer not null default 30000,
  high_ticket_threshold_xof integer not null default 1000000,
  high_ticket_bonus_rate numeric(5,4) not null default 0.02,
  low_performance_points_threshold integer not null default 60,
  annual_top1_min_points integer not null default 1600,
  annual_top2_min_points integer not null default 900,
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

-- 6. Table des Points et Primes par Vendeur
create table if not exists public.couture_seller_points (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.couture_employees(id) on delete cascade,
  site_id uuid references public.couture_sites(id) on delete set null,
  period_year integer not null,
  period_month integer not null,
  total_sales_xof bigint not null default 0,
  total_points integer not null default 0,
  high_ticket_bonuses_xof bigint not null default 0,
  weekly_bonus_xof bigint not null default 0,
  monthly_bonus_xof bigint not null default 0,
  loyalty_bonuses_xof bigint not null default 0,
  alert_level text not null default 'NONE' check (alert_level in ('NONE', 'LOW_PERFORMANCE_WARNING', 'REINFORCED_PERFORMANCE_WARNING')),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_id, period_year, period_month),
  unique (id, tenant_id)
);

create index if not exists couture_seller_points_rank_idx
  on public.couture_seller_points (tenant_id, period_year, period_month, total_points desc);

-- 7. Row Level Security & Politiques
alter table public.couture_work_schedules enable row level security;
alter table public.couture_attendance_logs enable row level security;
alter table public.couture_attendance_incidents enable row level security;
alter table public.couture_monthly_payrolls enable row level security;
alter table public.couture_sales_incentives_config enable row level security;
alter table public.couture_seller_points enable row level security;

revoke all on public.couture_work_schedules,
  public.couture_attendance_logs,
  public.couture_attendance_incidents,
  public.couture_monthly_payrolls,
  public.couture_sales_incentives_config,
  public.couture_seller_points from anon, authenticated;

grant select on public.couture_work_schedules,
  public.couture_attendance_logs,
  public.couture_attendance_incidents,
  public.couture_monthly_payrolls,
  public.couture_sales_incentives_config,
  public.couture_seller_points to authenticated;

grant select, insert, update, delete on public.couture_work_schedules,
  public.couture_attendance_logs,
  public.couture_attendance_incidents,
  public.couture_monthly_payrolls,
  public.couture_sales_incentives_config,
  public.couture_seller_points to service_role;

drop policy if exists couture_schedules_select on public.couture_work_schedules;
create policy couture_schedules_select on public.couture_work_schedules
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_attendance_select on public.couture_attendance_logs;
create policy couture_attendance_select on public.couture_attendance_logs
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_incidents_select on public.couture_attendance_incidents;
create policy couture_incidents_select on public.couture_attendance_incidents
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_monthly_payrolls_select on public.couture_monthly_payrolls;
create policy couture_monthly_payrolls_select on public.couture_monthly_payrolls
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_incentives_config_select on public.couture_sales_incentives_config;
create policy couture_incentives_config_select on public.couture_sales_incentives_config
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_seller_points_select on public.couture_seller_points;
create policy couture_seller_points_select on public.couture_seller_points
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
