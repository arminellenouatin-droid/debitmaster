-- DebitMaster Sprint 11: Personnel, Présences, Commissions, Dashboards par profil, Rapports et Notifications
-- Tables: commerce_attendance, commerce_sales_targets, commerce_commissions, commerce_notifications
-- Respect strict des règles de sécurité AGENTS.md : RLS activée, isolation multi-tenant, transactions atomiques

-- 1. Table des Présences / Pointage (commerce_attendance)
create table if not exists public.commerce_attendance (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null,
  work_date date not null default current_date,
  check_in_time timestamptz not null default now(),
  check_out_time timestamptz,
  status text not null default 'PRESENT' check (status in ('PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'EXCUSED')),
  minutes_late integer not null default 0 check (minutes_late >= 0),
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (employee_id, tenant_id) references public.commerce_employees(id, tenant_id) on delete cascade,
  unique (tenant_id, employee_id, work_date)
);

create index if not exists idx_commerce_attendance_tenant_date on public.commerce_attendance(tenant_id, work_date desc);
create index if not exists idx_commerce_attendance_employee on public.commerce_attendance(tenant_id, employee_id, work_date desc);

alter table public.commerce_attendance enable row level security;
revoke all on public.commerce_attendance from anon, authenticated;

create policy commerce_attendance_select on public.commerce_attendance
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = commerce_attendance.tenant_id
        and c.activity_type = 'BOUTIQUE_COMMERCE'
        and c.deleted_at is null
        and (c.owner_user_id = (select auth.uid()) or exists (
          select 1 from public.commerce_employees e
          where e.tenant_id = c.id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE'
        ))
    )
  );

create policy commerce_attendance_insert on public.commerce_attendance
  for insert to authenticated
  with check (
    exists (
      select 1 from public.companies c
      where c.id = commerce_attendance.tenant_id
        and c.activity_type = 'BOUTIQUE_COMMERCE'
        and c.deleted_at is null
        and (c.owner_user_id = (select auth.uid()) or exists (
          select 1 from public.commerce_employees e
          where e.tenant_id = c.id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE'
        ))
    )
  );

create policy commerce_attendance_update on public.commerce_attendance
  for update to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = commerce_attendance.tenant_id
        and c.activity_type = 'BOUTIQUE_COMMERCE'
        and c.deleted_at is null
        and (c.owner_user_id = (select auth.uid()) or exists (
          select 1 from public.commerce_employees e
          where e.tenant_id = c.id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE'
        ))
    )
  );

grant select, insert, update on public.commerce_attendance to authenticated, service_role;


-- 2. Table des Objectifs de Vente (commerce_sales_targets)
create table if not exists public.commerce_sales_targets (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null,
  period_month text not null check (period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  target_revenue_xof bigint not null check (target_revenue_xof >= 0),
  commission_rate_percent numeric(5,2) not null default 0.00 check (commission_rate_percent >= 0 and commission_rate_percent <= 100),
  commission_type text not null default 'REVENUE_PERCENT' check (commission_type in ('REVENUE_PERCENT', 'MARGIN_PERCENT', 'FIXED_BONUS')),
  fixed_bonus_xof bigint not null default 0 check (fixed_bonus_xof >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (employee_id, tenant_id) references public.commerce_employees(id, tenant_id) on delete cascade,
  unique (tenant_id, employee_id, period_month)
);

create index if not exists idx_commerce_sales_targets_period on public.commerce_sales_targets(tenant_id, period_month);

alter table public.commerce_sales_targets enable row level security;
revoke all on public.commerce_sales_targets from anon, authenticated;

create policy commerce_sales_targets_select on public.commerce_sales_targets
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = commerce_sales_targets.tenant_id
        and c.activity_type = 'BOUTIQUE_COMMERCE'
        and c.deleted_at is null
        and (c.owner_user_id = (select auth.uid()) or exists (
          select 1 from public.commerce_employees e
          where e.tenant_id = c.id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE'
        ))
    )
  );

create policy commerce_sales_targets_write on public.commerce_sales_targets
  for all to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = commerce_sales_targets.tenant_id
        and c.activity_type = 'BOUTIQUE_COMMERCE'
        and c.deleted_at is null
        and c.owner_user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.commerce_sales_targets to authenticated, service_role;


-- 3. Table des Commissions Calculées & Validées (commerce_commissions)
create table if not exists public.commerce_commissions (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null,
  period_month text not null check (period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  achieved_revenue_xof bigint not null default 0 check (achieved_revenue_xof >= 0),
  target_revenue_xof bigint not null default 0 check (target_revenue_xof >= 0),
  achievement_rate_percent numeric(6,2) not null default 0.00,
  commission_amount_xof bigint not null default 0 check (commission_amount_xof >= 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'PAID', 'CANCELLED')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (employee_id, tenant_id) references public.commerce_employees(id, tenant_id) on delete cascade,
  unique (tenant_id, employee_id, period_month)
);

create index if not exists idx_commerce_commissions_period on public.commerce_commissions(tenant_id, period_month, status);

alter table public.commerce_commissions enable row level security;
revoke all on public.commerce_commissions from anon, authenticated;

create policy commerce_commissions_select on public.commerce_commissions
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = commerce_commissions.tenant_id
        and c.activity_type = 'BOUTIQUE_COMMERCE'
        and c.deleted_at is null
        and (c.owner_user_id = (select auth.uid()) or exists (
          select 1 from public.commerce_employees e
          where e.tenant_id = c.id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE'
        ))
    )
  );

create policy commerce_commissions_write on public.commerce_commissions
  for all to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = commerce_commissions.tenant_id
        and c.activity_type = 'BOUTIQUE_COMMERCE'
        and c.deleted_at is null
        and c.owner_user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.commerce_commissions to authenticated, service_role;


-- 4. Table des Notifications Métier (commerce_notifications)
create table if not exists public.commerce_notifications (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  target_role text,
  title text not null check (char_length(trim(title)) between 2 and 200),
  message text not null,
  type text not null default 'INFO' check (type in ('INFO', 'SUCCESS', 'WARNING', 'ALERT')),
  link text,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists idx_commerce_notifs_tenant_user on public.commerce_notifications(tenant_id, recipient_user_id, is_read, created_at desc);
create index if not exists idx_commerce_notifs_role on public.commerce_notifications(tenant_id, target_role, is_read, created_at desc);

alter table public.commerce_notifications enable row level security;
revoke all on public.commerce_notifications from anon, authenticated;

create policy commerce_notifications_select on public.commerce_notifications
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = commerce_notifications.tenant_id
        and c.activity_type = 'BOUTIQUE_COMMERCE'
        and c.deleted_at is null
        and (
          c.owner_user_id = (select auth.uid())
          or commerce_notifications.recipient_user_id = (select auth.uid())
          or commerce_notifications.recipient_user_id is null
        )
    )
  );

create policy commerce_notifications_update on public.commerce_notifications
  for update to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = commerce_notifications.tenant_id
        and c.activity_type = 'BOUTIQUE_COMMERCE'
        and c.deleted_at is null
        and (
          c.owner_user_id = (select auth.uid())
          or commerce_notifications.recipient_user_id = (select auth.uid())
          or commerce_notifications.recipient_user_id is null
        )
    )
  );

grant select, insert, update on public.commerce_notifications to authenticated, service_role;
