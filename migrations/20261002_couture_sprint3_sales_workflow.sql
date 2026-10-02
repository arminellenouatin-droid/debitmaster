-- DebitMaster: Sprint 3 pour l'activité « Atelier de couture ».
-- Vente boutique : vente simple, commande, confection, retouche et règlements.
begin;

-- 1. Table des Ventes
create table if not exists public.couture_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  sale_number text not null check (sale_number ~ '^VTE-[0-9]{4}-[0-9]{6}$'),
  sale_type text not null default 'VENTE_SIMPLE' check (sale_type in ('VENTE_SIMPLE','COMMANDE','CONFECTION','RETOUCHE')),
  customer_id uuid references public.couture_customers(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT','CONFIRMED','PARTIALLY_PAID','PAID','FULFILLED','CANCELLED')),
  subtotal_amount_xof bigint not null default 0 check (subtotal_amount_xof >= 0),
  discount_amount_xof bigint not null default 0 check (discount_amount_xof >= 0),
  total_amount_xof bigint not null default 0 check (total_amount_xof >= 0),
  paid_amount_xof bigint not null default 0 check (paid_amount_xof >= 0),
  balance_amount_xof bigint not null default 0 check (balance_amount_xof >= 0),
  delivery_deadline date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists couture_sales_tenant_number_idx
  on public.couture_sales (tenant_id, sale_number);
create index if not exists couture_sales_tenant_site_date_idx
  on public.couture_sales (tenant_id, site_id, created_at desc);
create index if not exists couture_sales_tenant_customer_idx
  on public.couture_sales (tenant_id, customer_id);

-- 2. Table des Lignes de Vente
create table if not exists public.couture_sale_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  sale_id uuid not null,
  item_type text not null check (item_type in ('CLOTHING','ACCESSORY','CONFECTION_LABOR','ALTERATION_SERVICE')),
  model_id uuid references public.couture_models(id) on delete set null,
  range_id uuid references public.couture_ranges(id) on delete set null,
  size_id uuid references public.couture_sizes(id) on delete set null,
  color_id uuid references public.couture_colors(id) on delete set null,
  accessory_id uuid references public.couture_accessories(id) on delete set null,
  description text not null check (char_length(trim(description)) between 2 and 240),
  is_child boolean not null default false,
  quantity integer not null default 1 check (quantity >= 1),
  unit_price_xof bigint not null check (unit_price_xof >= 0),
  total_price_xof bigint not null check (total_price_xof >= 0),
  measurements_snapshot jsonb,
  fabric_provided_by_customer boolean not null default false,
  alteration_notes text,
  created_at timestamptz not null default now(),
  foreign key (sale_id, tenant_id) references public.couture_sales(id, tenant_id) on delete cascade,
  unique (id, tenant_id)
);
create index if not exists couture_sale_lines_tenant_sale_idx
  on public.couture_sale_lines (tenant_id, sale_id);

-- 3. Table des Règlements de Vente
create table if not exists public.couture_sale_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  sale_id uuid not null,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  payment_method text not null check (payment_method in ('CASH','MOBILE_MONEY','CARD','BANK_TRANSFER')),
  amount_xof bigint not null check (amount_xof > 0),
  reference text,
  received_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz not null default now(),
  foreign key (sale_id, tenant_id) references public.couture_sales(id, tenant_id) on delete cascade,
  unique (id, tenant_id)
);
create index if not exists couture_sale_payments_tenant_sale_idx
  on public.couture_sale_payments (tenant_id, sale_id);

-- 4. Row Level Security & Politiques
alter table public.couture_sales enable row level security;
alter table public.couture_sale_lines enable row level security;
alter table public.couture_sale_payments enable row level security;

revoke all on public.couture_sales, public.couture_sale_lines, public.couture_sale_payments from anon, authenticated;

grant select on public.couture_sales, public.couture_sale_lines, public.couture_sale_payments to authenticated;

grant select, insert, update, delete on public.couture_sales, public.couture_sale_lines, public.couture_sale_payments to service_role;

drop policy if exists couture_sales_select on public.couture_sales;
create policy couture_sales_select on public.couture_sales
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_sale_lines_select on public.couture_sale_lines;
create policy couture_sale_lines_select on public.couture_sale_lines
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_sale_payments_select on public.couture_sale_payments;
create policy couture_sale_payments_select on public.couture_sale_payments
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
