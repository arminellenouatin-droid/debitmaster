-- DebitManager stock workflow: boissons, vivres cuisine, remises quotidiennes et contrôle superviseur.

alter table public.products
  add column if not exists stock_family text not null default 'BEVERAGE';

alter table public.products
  drop constraint if exists products_stock_family_check;
alter table public.products
  add constraint products_stock_family_check
  check (stock_family in ('BEVERAGE', 'KITCHEN'));

create index if not exists products_tenant_stock_family_idx
  on public.products (tenant_id, stock_family)
  where deleted_at is null;

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  stock_family text not null check (stock_family in ('BEVERAGE', 'KITCHEN')),
  source_user_id uuid not null references auth.users(id),
  recipient_user_id uuid references auth.users(id),
  recipient_role text not null check (recipient_role in ('GERANT', 'CHEF_CUISINE', 'SERVEUR')),
  transfer_date date not null default current_date,
  status text not null default 'PREPARED' check (status in ('PREPARED', 'RECEIVED', 'DISTRIBUTED', 'CANCELLED')),
  items jsonb not null default '[]'::jsonb,
  notes text,
  received_at timestamptz,
  received_by uuid references auth.users(id),
  distributed_at timestamptz,
  distributed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_transfers_tenant_date_idx
  on public.stock_transfers (tenant_id, transfer_date desc, created_at desc);

alter table public.stock_transfers enable row level security;

drop policy if exists stock_transfers_select_authorized on public.stock_transfers;
create policy stock_transfers_select_authorized on public.stock_transfers
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.view'));

drop policy if exists stock_transfers_insert_authorized on public.stock_transfers;
create policy stock_transfers_insert_authorized on public.stock_transfers
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'stock.handoff'));

drop policy if exists stock_transfers_update_authorized on public.stock_transfers;
create policy stock_transfers_update_authorized on public.stock_transfers
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.handoff') or private.has_tenant_permission(tenant_id, 'stock.accept_kitchen'))
  with check (private.has_tenant_permission(tenant_id, 'stock.handoff') or private.has_tenant_permission(tenant_id, 'stock.accept_kitchen'));

create table if not exists public.daily_stock_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  business_date date not null,
  supervisor_id uuid not null references auth.users(id),
  actual_sales_xof integer not null default 0 check (actual_sales_xof >= 0),
  closing_stock_snapshot jsonb not null default '{}'::jsonb,
  checked_magasinier_id uuid references auth.users(id),
  status text not null default 'OPEN' check (status in ('OPEN', 'VALIDATED', 'DISCREPANCY')),
  notes text,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, business_date)
);

alter table public.daily_stock_controls enable row level security;

drop policy if exists daily_stock_controls_select_authorized on public.daily_stock_controls;
create policy daily_stock_controls_select_authorized on public.daily_stock_controls
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.audit') or private.has_tenant_permission(tenant_id, 'reports.daily_close'));

drop policy if exists daily_stock_controls_write_authorized on public.daily_stock_controls;
create policy daily_stock_controls_write_authorized on public.daily_stock_controls
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'reports.daily_close'));

drop policy if exists daily_stock_controls_update_authorized on public.daily_stock_controls;
create policy daily_stock_controls_update_authorized on public.daily_stock_controls
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'reports.daily_close'))
  with check (private.has_tenant_permission(tenant_id, 'reports.daily_close'));

-- The API remains responsible for validating item ownership and transition semantics.
