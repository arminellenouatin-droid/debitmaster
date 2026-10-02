-- DebitMaster: Sprint 8 pour l'activité « Atelier de couture ».
-- Stocks multi-sites, transferts inter-boutiques/ateliers et inventaires physiques.
begin;

-- 1. Table des Stocks Produits Finis par Boutique
create table if not exists public.couture_boutique_stocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  product_type text not null check (product_type in ('CLOTHING', 'ACCESSORY')),
  model_id uuid references public.couture_models(id) on delete set null,
  range_id uuid references public.couture_ranges(id) on delete set null,
  size_id uuid references public.couture_sizes(id) on delete set null,
  color_id uuid references public.couture_colors(id) on delete set null,
  accessory_id uuid references public.couture_accessories(id) on delete set null,
  quantity integer not null default 0 check (quantity >= 0),
  min_threshold integer not null default 2 check (min_threshold >= 0),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists couture_boutique_stocks_site_idx
  on public.couture_boutique_stocks (tenant_id, site_id);

-- 2. Table des Transferts Multi-Sites
create table if not exists public.couture_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  transfer_number text not null check (transfer_number ~ '^TRF-[0-9]{4}-[0-9]{6}$'),
  transfer_type text not null check (transfer_type in ('ATELIER_TO_BOUTIQUE','BOUTIQUE_TO_BOUTIQUE','BOUTIQUE_TO_ATELIER','ATELIER_TO_ATELIER')),
  source_site_id uuid not null references public.couture_sites(id) on delete restrict,
  destination_site_id uuid not null references public.couture_sites(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT','IN_TRANSIT','RECEIVED','DISCREPANCY','CANCELLED')),
  shipped_by uuid references auth.users(id) on delete set null,
  shipped_at timestamptz,
  received_by uuid references auth.users(id) on delete set null,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, transfer_number),
  unique (id, tenant_id)
);

create index if not exists couture_transfers_tenant_status_idx
  on public.couture_transfers (tenant_id, status);

-- 3. Table des Lignes de Transfert
create table if not exists public.couture_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  transfer_id uuid not null,
  item_type text not null check (item_type in ('CLOTHING','ACCESSORY','SUPPLY')),
  model_id uuid references public.couture_models(id) on delete set null,
  range_id uuid references public.couture_ranges(id) on delete set null,
  size_id uuid references public.couture_sizes(id) on delete set null,
  color_id uuid references public.couture_colors(id) on delete set null,
  accessory_id uuid references public.couture_accessories(id) on delete set null,
  supply_id uuid references public.couture_supplies(id) on delete set null,
  description text not null check (char_length(trim(description)) between 2 and 240),
  quantity_shipped numeric(14,2) not null check (quantity_shipped > 0),
  quantity_received numeric(14,2) default 0 check (quantity_received >= 0),
  discrepancy_quantity numeric(14,2) default 0,
  foreign key (transfer_id, tenant_id) references public.couture_transfers(id, tenant_id) on delete cascade,
  unique (id, tenant_id)
);

create index if not exists couture_transfer_lines_tenant_idx
  on public.couture_transfer_lines (tenant_id, transfer_id);

-- 4. Table des Sessions d'Inventaire Physique
create table if not exists public.couture_inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  inventory_number text not null check (inventory_number ~ '^INV-[0-9]{4}-[0-9]{6}$'),
  inventory_type text not null check (inventory_type in ('BOUTIQUE_FINISHED_GOODS','ATELIER_SUPPLIES')),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','COMPLETED','VALIDATED','CANCELLED')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, inventory_number),
  unique (id, tenant_id)
);

create index if not exists couture_inv_sessions_site_idx
  on public.couture_inventory_sessions (tenant_id, site_id, status);

-- 5. Table des Comptages d'Inventaire
create table if not exists public.couture_inventory_counts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  session_id uuid not null,
  item_type text not null check (item_type in ('CLOTHING','ACCESSORY','SUPPLY')),
  reference_id uuid not null,
  item_label text not null check (char_length(trim(item_label)) between 2 and 240),
  theoretical_quantity numeric(14,2) not null default 0 check (theoretical_quantity >= 0),
  counted_quantity numeric(14,2) not null check (counted_quantity >= 0),
  variance_quantity numeric(14,2) not null default 0,
  unit_cost_xof bigint not null default 0 check (unit_cost_xof >= 0),
  variance_value_xof bigint not null default 0,
  foreign key (session_id, tenant_id) references public.couture_inventory_sessions(id, tenant_id) on delete cascade,
  unique (id, tenant_id)
);

create index if not exists couture_inv_counts_session_idx
  on public.couture_inventory_counts (tenant_id, session_id);

-- 6. Row Level Security & Politiques
alter table public.couture_boutique_stocks enable row level security;
alter table public.couture_transfers enable row level security;
alter table public.couture_transfer_lines enable row level security;
alter table public.couture_inventory_sessions enable row level security;
alter table public.couture_inventory_counts enable row level security;

revoke all on public.couture_boutique_stocks,
  public.couture_transfers,
  public.couture_transfer_lines,
  public.couture_inventory_sessions,
  public.couture_inventory_counts from anon, authenticated;

grant select on public.couture_boutique_stocks,
  public.couture_transfers,
  public.couture_transfer_lines,
  public.couture_inventory_sessions,
  public.couture_inventory_counts to authenticated;

grant select, insert, update, delete on public.couture_boutique_stocks,
  public.couture_transfers,
  public.couture_transfer_lines,
  public.couture_inventory_sessions,
  public.couture_inventory_counts to service_role;

drop policy if exists couture_boutique_stocks_select on public.couture_boutique_stocks;
create policy couture_boutique_stocks_select on public.couture_boutique_stocks
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_transfers_select on public.couture_transfers;
create policy couture_transfers_select on public.couture_transfers
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_transfer_lines_select on public.couture_transfer_lines;
create policy couture_transfer_lines_select on public.couture_transfer_lines
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_inv_sessions_select on public.couture_inventory_sessions;
create policy couture_inv_sessions_select on public.couture_inventory_sessions
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_inv_counts_select on public.couture_inventory_counts;
create policy couture_inv_counts_select on public.couture_inventory_counts
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
