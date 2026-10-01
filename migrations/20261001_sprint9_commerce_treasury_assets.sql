-- DebitMaster Sprint 9: Trésorerie, Dépenses et Immobilisations
-- Tables : commerce_treasury_accounts, commerce_treasury_transactions, commerce_treasury_transfers,
--          commerce_expenses, commerce_fixed_assets, commerce_asset_depreciation_lines
-- Respect strict des règles de sécurité AGENTS.md : RLS activée, isolation multi-tenant, transactions atomiques, contrôle d'accès serveur, séparation des tâches.

-- 1. Élargissement des types de documents dans document_sequences
alter table public.document_sequences drop constraint if exists document_sequences_doc_type_check;
alter table public.document_sequences add constraint document_sequences_doc_type_check
  check (doc_type in (
    'QUOTE', 'INVOICE', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE',
    'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'STOCK_TRANSFER',
    'INVENTORY_SESSION', 'EXPENSE', 'TREASURY_TRANSFER', 'FIXED_ASSET'
  ));

-- 2. Mise à jour de la fonction next_document_number pour supporter DEP, VIR, IMM
create or replace function public.next_document_number(p_tenant_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from now())::int;
  v_num int;
  v_prefix text;
begin
  if p_doc_type = 'QUOTE' then v_prefix := 'DEV';
  elsif p_doc_type = 'INVOICE' then v_prefix := 'FAC';
  elsif p_doc_type = 'PROFORMA' then v_prefix := 'PRO';
  elsif p_doc_type = 'DELIVERY_NOTE' then v_prefix := 'BL';
  elsif p_doc_type = 'CREDIT_NOTE' then v_prefix := 'AVR';
  elsif p_doc_type = 'PURCHASE_REQUEST' then v_prefix := 'DA';
  elsif p_doc_type = 'PURCHASE_ORDER' then v_prefix := 'BC';
  elsif p_doc_type = 'GOODS_RECEIPT' then v_prefix := 'BR';
  elsif p_doc_type = 'STOCK_TRANSFER' then v_prefix := 'TRF';
  elsif p_doc_type = 'INVENTORY_SESSION' then v_prefix := 'INV';
  elsif p_doc_type = 'EXPENSE' then v_prefix := 'DEP';
  elsif p_doc_type = 'TREASURY_TRANSFER' then v_prefix := 'VIR';
  elsif p_doc_type = 'FIXED_ASSET' then v_prefix := 'IMM';
  else v_prefix := 'DOC';
  end if;

  insert into public.document_sequences (tenant_id, doc_type, year, current_number)
  values (p_tenant_id, p_doc_type, v_year, 1)
  on conflict (tenant_id, doc_type, year)
  do update set current_number = public.document_sequences.current_number + 1
  returning current_number into v_num;

  return v_prefix || '-' || v_year || '-' || lpad(v_num::text, 6, '0');
end;
$$;

revoke all on function public.next_document_number(uuid, text) from public, anon;
grant execute on function public.next_document_number(uuid, text) to authenticated, service_role;

-- 3. Table des Comptes de Trésorerie (Caisses, Banques, Mobile Money)
create table if not exists public.commerce_treasury_accounts (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('CASH', 'BANK', 'MOBILE_MONEY')),
  account_number text,
  bank_name text,
  initial_balance_xof bigint not null default 0,
  current_balance_xof bigint not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  store_id uuid references public.commerce_stores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commerce_treasury_accounts_tenant on public.commerce_treasury_accounts(tenant_id, status);

-- 4. Table des Transactions et Mouvements de Trésorerie
create table if not exists public.commerce_treasury_transactions (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  account_id uuid not null references public.commerce_treasury_accounts(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT')),
  amount_xof bigint not null check (amount_xof > 0),
  balance_after_xof bigint not null,
  reference text not null,
  category text,
  description text,
  related_entity_type text,
  related_entity_id uuid,
  performed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_commerce_treasury_tx_tenant on public.commerce_treasury_transactions(tenant_id, created_at desc);
create index if not exists idx_commerce_treasury_tx_account on public.commerce_treasury_transactions(account_id);

-- 5. Table des Virements Internes de Trésorerie
create table if not exists public.commerce_treasury_transfers (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  transfer_number text not null,
  source_account_id uuid not null references public.commerce_treasury_accounts(id) on delete restrict,
  destination_account_id uuid not null references public.commerce_treasury_accounts(id) on delete restrict,
  amount_xof bigint not null check (amount_xof > 0),
  transfer_fee_xof bigint not null default 0 check (transfer_fee_xof >= 0),
  status text not null default 'COMPLETED' check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),
  notes text,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint uq_commerce_treasury_transfer unique (tenant_id, transfer_number)
);

create index if not exists idx_commerce_treasury_transfers_tenant on public.commerce_treasury_transfers(tenant_id);

-- 6. Table des Dépenses & Charges
create table if not exists public.commerce_expenses (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  expense_number text not null,
  title text not null,
  category text not null check (category in (
    'LOYER', 'ENERGIE_EAU', 'FOURNITURES', 'TRANSPORT_CARBURANT',
    'SALAIRES_PRIMES', 'ENTRETIEN_REPARATION', 'IMPOTS_TAXES',
    'FRAIS_BANCAIRES', 'MARKETING_COMMUNICATION', 'DIVERS'
  )),
  amount_xof bigint not null check (amount_xof > 0),
  tax_amount_xof bigint not null default 0,
  total_amount_xof bigint not null check (total_amount_xof > 0),
  paid_from_account_id uuid references public.commerce_treasury_accounts(id) on delete restrict,
  beneficiary text,
  receipt_reference text,
  receipt_url text,
  status text not null default 'PAID' check (status in ('PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED')),
  approval_threshold_exceeded boolean default false,
  notes text,
  expense_date date not null default current_date,
  created_by_user_id uuid not null references auth.users(id),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_commerce_expense unique (tenant_id, expense_number)
);

create index if not exists idx_commerce_expenses_tenant on public.commerce_expenses(tenant_id, status, expense_date desc);

-- 7. Table des Immobilisations
create table if not exists public.commerce_fixed_assets (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  asset_code text not null,
  name text not null,
  syscohada_account text not null default '241' check (syscohada_account in ('21', '22', '23', '241', '244', '245', '248')),
  category text not null check (category in (
    'MATERIEL_INFORMATIQUE', 'MATERIEL_EXPLOITATION', 'MOBILIER_BUREAU',
    'VEHICULE_TRANSPORT', 'INSTALLATION_AGENCEMENT', 'LOGICIEL_LICENCE', 'AUTRE'
  )),
  acquisition_date date not null,
  acquisition_cost_xof bigint not null check (acquisition_cost_xof > 0),
  salvage_value_xof bigint not null default 0 check (salvage_value_xof >= 0),
  lifespan_years integer not null check (lifespan_years between 1 and 50),
  depreciation_method text not null default 'LINEAIRE' check (depreciation_method in ('LINEAIRE', 'DEGRESSIF')),
  location text,
  store_id uuid references public.commerce_stores(id) on delete set null,
  serial_number text,
  supplier_name text,
  accumulated_depreciation_xof bigint not null default 0,
  net_book_value_xof bigint not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SCRAPPED', 'SOLD')),
  disposal_date date,
  disposal_proceeds_xof bigint default 0,
  disposal_notes text,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_commerce_asset unique (tenant_id, asset_code)
);

create index if not exists idx_commerce_assets_tenant on public.commerce_fixed_assets(tenant_id, status);

-- 8. Table des Lignes d'Amortissement Prévisionnel
create table if not exists public.commerce_asset_depreciation_lines (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid not null references public.commerce_fixed_assets(id) on delete cascade,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  period_year integer not null,
  base_amount_xof bigint not null,
  depreciation_amount_xof bigint not null,
  accumulated_depreciation_xof bigint not null,
  net_book_value_xof bigint not null,
  is_posted boolean not null default false,
  created_at timestamptz not null default now(),
  constraint uq_asset_deprec_period unique (asset_id, period_year)
);

create index if not exists idx_commerce_asset_deprec_asset on public.commerce_asset_depreciation_lines(asset_id);

-- 9. Sécurité RLS et Politiques Multi-Tenant
alter table public.commerce_treasury_accounts enable row level security;
alter table public.commerce_treasury_transactions enable row level security;
alter table public.commerce_treasury_transfers enable row level security;
alter table public.commerce_expenses enable row level security;
alter table public.commerce_fixed_assets enable row level security;
alter table public.commerce_asset_depreciation_lines enable row level security;

revoke all on public.commerce_treasury_accounts from anon;
revoke all on public.commerce_treasury_transactions from anon;
revoke all on public.commerce_treasury_transfers from anon;
revoke all on public.commerce_expenses from anon;
revoke all on public.commerce_fixed_assets from anon;
revoke all on public.commerce_asset_depreciation_lines from anon;

drop policy if exists "commerce_treasury_accounts_tenant" on public.commerce_treasury_accounts;
create policy "commerce_treasury_accounts_tenant" on public.commerce_treasury_accounts
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_treasury_tx_tenant" on public.commerce_treasury_transactions;
create policy "commerce_treasury_tx_tenant" on public.commerce_treasury_transactions
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_treasury_transfers_tenant" on public.commerce_treasury_transfers;
create policy "commerce_treasury_transfers_tenant" on public.commerce_treasury_transfers
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_expenses_tenant" on public.commerce_expenses;
create policy "commerce_expenses_tenant" on public.commerce_expenses
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_fixed_assets_tenant" on public.commerce_fixed_assets;
create policy "commerce_fixed_assets_tenant" on public.commerce_fixed_assets
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_asset_deprec_tenant" on public.commerce_asset_depreciation_lines;
create policy "commerce_asset_deprec_tenant" on public.commerce_asset_depreciation_lines
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));
