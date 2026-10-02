-- DebitMaster: Sprint 6 pour l'activité « Atelier de couture ».
-- Paie à la tâche des ouvriers (barème des tâches, tâches accomplies et paie hebdomadaire).
begin;

-- 1. Table du Barème des Tâches Ouvrières
create table if not exists public.couture_piecework_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  task_code text not null check (char_length(trim(task_code)) between 2 and 60),
  task_label text not null check (char_length(trim(task_label)) between 2 and 120),
  rate_without_embroidery_xof bigint not null check (rate_without_embroidery_xof >= 0),
  rate_with_embroidery_xof bigint not null check (rate_with_embroidery_xof >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, task_code)
);

create index if not exists couture_rates_tenant_active_idx
  on public.couture_piecework_rates (tenant_id, is_active);

-- 2. Table des Tâches Accomplies par les Ouvriers
create table if not exists public.couture_completed_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  employee_id uuid not null references public.couture_employees(id) on delete restrict,
  worker_user_id uuid references auth.users(id) on delete set null,
  card_id uuid references public.couture_production_cards(id) on delete set null,
  step_id uuid references public.couture_production_steps(id) on delete set null,
  task_code text not null,
  task_label text not null,
  has_embroidery boolean not null default false,
  unit_rate_xof bigint not null check (unit_rate_xof >= 0),
  is_overtime boolean not null default false,
  overtime_multiplier numeric(3,2) not null default 1.0 check (overtime_multiplier >= 1.0),
  final_amount_xof bigint not null check (final_amount_xof >= 0),
  validated_by_supervisor boolean not null default false,
  supervisor_user_id uuid references auth.users(id) on delete set null,
  completed_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists couture_tasks_tenant_emp_date_idx
  on public.couture_completed_tasks (tenant_id, employee_id, completed_date desc);
create index if not exists couture_tasks_tenant_site_date_idx
  on public.couture_completed_tasks (tenant_id, site_id, completed_date desc);

-- 3. Table des Décomptes de Paie Hebdomadaires Ouvriers
create table if not exists public.couture_weekly_payrolls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  employee_id uuid not null references public.couture_employees(id) on delete restrict,
  week_start_date date not null,
  week_end_date date not null,
  tasks_count integer not null default 0 check (tasks_count >= 0),
  base_amount_xof bigint not null default 0 check (base_amount_xof >= 0),
  overtime_amount_xof bigint not null default 0 check (overtime_amount_xof >= 0),
  bonus_amount_xof bigint not null default 0 check (bonus_amount_xof >= 0),
  deduction_amount_xof bigint not null default 0 check (deduction_amount_xof >= 0),
  net_amount_xof bigint not null check (net_amount_xof >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'VALIDATED', 'PAID')),
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_id, week_start_date),
  unique (id, tenant_id)
);

create index if not exists couture_payrolls_tenant_week_idx
  on public.couture_weekly_payrolls (tenant_id, week_start_date desc);

-- 4. Row Level Security & Politiques
alter table public.couture_piecework_rates enable row level security;
alter table public.couture_completed_tasks enable row level security;
alter table public.couture_weekly_payrolls enable row level security;

revoke all on public.couture_piecework_rates, public.couture_completed_tasks, public.couture_weekly_payrolls from anon, authenticated;

grant select on public.couture_piecework_rates, public.couture_completed_tasks, public.couture_weekly_payrolls to authenticated;
grant select, insert, update, delete on public.couture_piecework_rates, public.couture_completed_tasks, public.couture_weekly_payrolls to service_role;

drop policy if exists couture_piecework_rates_select on public.couture_piecework_rates;
create policy couture_piecework_rates_select on public.couture_piecework_rates
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_completed_tasks_select on public.couture_completed_tasks;
create policy couture_completed_tasks_select on public.couture_completed_tasks
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_weekly_payrolls_select on public.couture_weekly_payrolls;
create policy couture_weekly_payrolls_select on public.couture_weekly_payrolls
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
