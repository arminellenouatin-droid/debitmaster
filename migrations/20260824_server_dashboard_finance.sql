-- DebitManager: espace individuel serveur/serveuse et reversement propriétaire-promoteur.

alter table public.employees
  add column if not exists service_start_time time,
  add column if not exists service_end_time time,
  add column if not exists rest_day smallint;

alter table public.employees
  drop constraint if exists employees_rest_day_check;
alter table public.employees
  add constraint employees_rest_day_check check (rest_day is null or rest_day between 0 and 6);

alter table public.orders
  add column if not exists server_user_id uuid references auth.users(id);
create index if not exists orders_tenant_server_created_idx on public.orders (tenant_id, server_user_id, created_at desc);

create table if not exists public.employee_table_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  table_id uuid not null references public.dining_tables(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (employee_id, table_id)
);
create index if not exists employee_table_assignments_tenant_employee_idx on public.employee_table_assignments (tenant_id, employee_id);
alter table public.employee_table_assignments enable row level security;
create policy employee_table_assignments_select_member on public.employee_table_assignments for select to authenticated using (tenant_id = private.current_tenant_id() or private.has_tenant_permission(tenant_id, 'team.manage'));
create policy employee_table_assignments_manage on public.employee_table_assignments for all to authenticated using (private.has_tenant_permission(tenant_id, 'team.manage')) with check (private.has_tenant_permission(tenant_id, 'team.manage'));

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  full_name varchar(160) not null,
  phone varchar(32),
  customer_type text not null default 'COUNTER' check (customer_type in ('COUNTER', 'NAMED')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_tenant_name_idx on public.customers (tenant_id, full_name);
alter table public.customers enable row level security;
create policy customers_select_member on public.customers for select to authenticated using (private.has_tenant_permission(tenant_id, 'orders.view'));
create policy customers_insert_order_taker on public.customers for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'orders.create') and created_by = (select auth.uid()));
create policy customers_update_manager on public.customers for update to authenticated using (private.has_tenant_permission(tenant_id, 'team.manage')) with check (private.has_tenant_permission(tenant_id, 'team.manage'));

create table if not exists public.employee_sales_commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  base_amount integer not null check (base_amount >= 0),
  commission_rate numeric(5,2) not null default 0 check (commission_rate between 0 and 100),
  commission_amount integer not null default 0 check (commission_amount >= 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'PAID')),
  created_at timestamptz not null default now(),
  unique (employee_id, order_id)
);
create index if not exists employee_sales_commissions_employee_idx on public.employee_sales_commissions (tenant_id, employee_id, created_at desc);
alter table public.employee_sales_commissions enable row level security;
create policy employee_sales_commissions_select on public.employee_sales_commissions for select to authenticated using (employee_id in (select e.id from public.employees e where e.user_id = (select auth.uid())) or private.has_tenant_permission(tenant_id, 'finance.view'));
create policy employee_sales_commissions_manage on public.employee_sales_commissions for all to authenticated using (private.has_tenant_permission(tenant_id, 'finance.manage')) with check (private.has_tenant_permission(tenant_id, 'finance.manage'));

create table if not exists public.establishment_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  gross_amount integer not null check (gross_amount >= 0),
  saas_fee_amount integer not null check (saas_fee_amount >= 0),
  net_amount integer not null check (net_amount >= 0),
  status text not null default 'VERIFYING' check (status in ('VERIFYING', 'APPROVED', 'PAID', 'REJECTED')),
  verification_ends_at timestamptz not null,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists establishment_settlements_tenant_status_idx on public.establishment_settlements (tenant_id, status, created_at desc);
alter table public.establishment_settlements enable row level security;
create policy establishment_settlements_owner_select on public.establishment_settlements for select to authenticated using (private.has_tenant_permission(tenant_id, 'finance.view'));
create policy establishment_settlements_owner_insert on public.establishment_settlements for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'finance.view') and requested_by = (select auth.uid()));
create policy establishment_settlements_master_manage on public.establishment_settlements for update to authenticated using (private.has_tenant_permission(tenant_id, 'finance.manage')) with check (private.has_tenant_permission(tenant_id, 'finance.manage'));

-- Synchronise the order owner used for individual server dashboards.
