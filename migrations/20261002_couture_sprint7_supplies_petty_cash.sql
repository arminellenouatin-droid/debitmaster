-- DebitMaster: Sprint 7 pour l'activité « Atelier de couture ».
-- Fournitures atelier : catalogue fournitures, demandes d'achat avec seuil (<50k vs >=50k), et petite caisse.
begin;

-- 1. Table du Référentiel des Fournitures d'Atelier
create table if not exists public.couture_supplies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  category text not null check (category in ('FABRIC','THREAD','BUTTON','ZIPPER','LINING','ACCESSORY_HARDWARE','PACKAGING','OTHER')),
  code text not null check (char_length(trim(code)) between 2 and 60),
  name text not null check (char_length(trim(name)) between 2 and 120),
  unit text not null check (unit in ('METRE','PIECE','ROULEAU','BOITE','BOBINE','PAQUET')),
  color text,
  reorder_threshold numeric(14,2) not null default 5.0 check (reorder_threshold >= 0),
  cost_price_xof bigint not null default 0 check (cost_price_xof >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (id, tenant_id)
);

create index if not exists couture_supplies_tenant_cat_idx
  on public.couture_supplies (tenant_id, category);

-- 2. Table des Stocks de Fournitures par Atelier
create table if not exists public.couture_workshop_supply_stocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  supply_id uuid not null,
  quantity numeric(14,2) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  foreign key (supply_id, tenant_id) references public.couture_supplies(id, tenant_id) on delete cascade,
  unique (site_id, supply_id),
  unique (id, tenant_id)
);

create index if not exists couture_supply_stocks_tenant_site_idx
  on public.couture_workshop_supply_stocks (tenant_id, site_id);

-- 3. Table des Demandes d'Achat de Fournitures avec Circuit à Seuil
create table if not exists public.couture_supply_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  request_number text not null check (request_number ~ '^DA-[0-9]{4}-[0-9]{6}$'),
  supply_id uuid references public.couture_supplies(id) on delete set null,
  description text not null check (char_length(trim(description)) between 2 and 240),
  quantity numeric(14,2) not null check (quantity > 0),
  estimated_cost_xof bigint not null check (estimated_cost_xof > 0),
  approval_route text not null check (approval_route in ('SINGLE_ACCOUNTANT','THREE_STEP')),
  buyer_opinion text check (buyer_opinion in ('PENDING','FAVORABLE','UNFAVORABLE')),
  buyer_notes text,
  buyer_user_id uuid references auth.users(id) on delete set null,
  accountant_approval text not null default 'PENDING' check (accountant_approval in ('PENDING','APPROVED','REJECTED')),
  accountant_notes text,
  accountant_user_id uuid references auth.users(id) on delete set null,
  direction_approval text not null default 'NOT_REQUIRED' check (direction_approval in ('NOT_REQUIRED','PENDING','APPROVED','REJECTED')),
  direction_notes text,
  direction_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','ORDERED','RECEIVED','CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, request_number),
  unique (id, tenant_id)
);

create index if not exists couture_purchase_reqs_tenant_status_idx
  on public.couture_supply_purchase_requests (tenant_id, status);

-- 4. Table des Fonds de Petite Caisse d'Atelier (fonds 20 000 FCFA)
create table if not exists public.couture_petty_cash_funds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  custodian_employee_id uuid references public.couture_employees(id) on delete set null,
  fund_limit_xof bigint not null default 20000 check (fund_limit_xof > 0),
  current_balance_xof bigint not null default 20000 check (current_balance_xof >= 0),
  updated_at timestamptz not null default now(),
  unique (site_id),
  unique (id, tenant_id)
);

-- 5. Table des Dépenses de Petite Caisse (plafond 2 000 FCFA)
create table if not exists public.couture_petty_cash_expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  expense_number text not null check (expense_number ~ '^PC-[0-9]{4}-[0-9]{6}$'),
  amount_xof bigint not null check (amount_xof > 0 and amount_xof <= 2000),
  purpose text not null check (char_length(trim(purpose)) between 2 and 240),
  receipt_url text,
  visa_status text not null default 'PENDING' check (visa_status in ('PENDING','APPROVED','REJECTED')),
  visa_by_user_id uuid references auth.users(id) on delete set null,
  visa_at timestamptz,
  visa_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, expense_number),
  unique (id, tenant_id)
);

create index if not exists couture_petty_cash_tenant_site_idx
  on public.couture_petty_cash_expenses (tenant_id, site_id, created_at desc);

-- 6. Row Level Security & Politiques
alter table public.couture_supplies enable row level security;
alter table public.couture_workshop_supply_stocks enable row level security;
alter table public.couture_supply_purchase_requests enable row level security;
alter table public.couture_petty_cash_funds enable row level security;
alter table public.couture_petty_cash_expenses enable row level security;

revoke all on public.couture_supplies,
  public.couture_workshop_supply_stocks,
  public.couture_supply_purchase_requests,
  public.couture_petty_cash_funds,
  public.couture_petty_cash_expenses from anon, authenticated;

grant select on public.couture_supplies,
  public.couture_workshop_supply_stocks,
  public.couture_supply_purchase_requests,
  public.couture_petty_cash_funds,
  public.couture_petty_cash_expenses to authenticated;

grant select, insert, update, delete on public.couture_supplies,
  public.couture_workshop_supply_stocks,
  public.couture_supply_purchase_requests,
  public.couture_petty_cash_funds,
  public.couture_petty_cash_expenses to service_role;

drop policy if exists couture_supplies_select on public.couture_supplies;
create policy couture_supplies_select on public.couture_supplies
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_supply_stocks_select on public.couture_workshop_supply_stocks;
create policy couture_supply_stocks_select on public.couture_workshop_supply_stocks
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_purchase_reqs_select on public.couture_supply_purchase_requests;
create policy couture_purchase_reqs_select on public.couture_supply_purchase_requests
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_petty_funds_select on public.couture_petty_cash_funds;
create policy couture_petty_funds_select on public.couture_petty_cash_funds
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_petty_expenses_select on public.couture_petty_cash_expenses;
create policy couture_petty_expenses_select on public.couture_petty_cash_expenses
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
