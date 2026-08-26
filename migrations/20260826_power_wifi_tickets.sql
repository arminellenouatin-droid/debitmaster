-- DebitManager Power: ticket WIFI inventory and sales, tenant-scoped.
create table if not exists public.power_wifi_ticket_inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  ticket_code text not null check (ticket_code in ('3_HOURS','72_HOURS','1_MONTH')),
  label text not null,
  duration_label text not null,
  unit_price_xof integer not null check (unit_price_xof >= 0),
  received_quantity integer not null default 0 check (received_quantity >= 0),
  sold_quantity integer not null default 0 check (sold_quantity >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, ticket_code),
  check (sold_quantity <= received_quantity)
);
create table if not exists public.power_wifi_ticket_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  ticket_code text not null check (ticket_code in ('3_HOURS','72_HOURS','1_MONTH')),
  quantity integer not null check (quantity > 0),
  unit_price_xof integer not null check (unit_price_xof >= 0),
  total_amount_xof integer generated always as (quantity * unit_price_xof) stored,
  customer_name varchar(160),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists power_wifi_ticket_inventory_tenant_idx on public.power_wifi_ticket_inventory (tenant_id, ticket_code);
create index if not exists power_wifi_ticket_sales_tenant_idx on public.power_wifi_ticket_sales (tenant_id, created_at desc);
alter table public.power_wifi_ticket_inventory enable row level security;
alter table public.power_wifi_ticket_sales enable row level security;
drop policy if exists power_wifi_ticket_inventory_select on public.power_wifi_ticket_inventory;
create policy power_wifi_ticket_inventory_select on public.power_wifi_ticket_inventory for select to authenticated using (private.has_tenant_permission(tenant_id, 'services.view') or private.has_tenant_permission(tenant_id, 'finance.view'));
drop policy if exists power_wifi_ticket_inventory_write on public.power_wifi_ticket_inventory;
create policy power_wifi_ticket_inventory_write on public.power_wifi_ticket_inventory for all to authenticated using (private.has_tenant_permission(tenant_id, 'services.manage') or private.has_tenant_permission(tenant_id, 'finance.view')) with check (private.has_tenant_permission(tenant_id, 'services.manage') or private.has_tenant_permission(tenant_id, 'finance.view'));
drop policy if exists power_wifi_ticket_sales_select on public.power_wifi_ticket_sales;
create policy power_wifi_ticket_sales_select on public.power_wifi_ticket_sales for select to authenticated using (private.has_tenant_permission(tenant_id, 'services.view') or private.has_tenant_permission(tenant_id, 'finance.view'));
drop policy if exists power_wifi_ticket_sales_insert on public.power_wifi_ticket_sales;
create policy power_wifi_ticket_sales_insert on public.power_wifi_ticket_sales for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'payments.create'));
