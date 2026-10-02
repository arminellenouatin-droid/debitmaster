-- DebitMaster: Sprint 9 pour l'activité « Atelier de couture ».
-- Trésorerie multi-caisses, virements internes et comptabilité SYSCOHADA (avec consolidation multidevise).
begin;

-- 1. Table des Comptes de Trésorerie (Caisses, Banques, Mobile Money, TPE, Petite caisse)
create table if not exists public.couture_treasury_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid references public.couture_sites(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  account_type text not null check (account_type in ('CASH', 'BANK', 'MOBILE_MONEY', 'POS', 'PETTY_CASH')),
  currency text not null default 'FCFA',
  initial_balance bigint not null default 0,
  current_balance bigint not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists couture_treasury_accounts_tenant_idx
  on public.couture_treasury_accounts (tenant_id, status);

-- 2. Table des Transactions et Mouvements de Trésorerie
create table if not exists public.couture_treasury_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  account_id uuid not null,
  transaction_type text not null check (transaction_type in ('INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT')),
  amount bigint not null check (amount > 0),
  balance_after bigint not null,
  currency text not null default 'FCFA',
  reference text not null,
  description text,
  related_entity_type text,
  related_entity_id uuid,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (account_id, tenant_id) references public.couture_treasury_accounts(id, tenant_id) on delete restrict,
  unique (id, tenant_id)
);

create index if not exists couture_treasury_tx_tenant_idx
  on public.couture_treasury_transactions (tenant_id, account_id, created_at desc);

-- 3. Table des Virements Internes de Trésorerie
create table if not exists public.couture_treasury_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  transfer_number text not null check (transfer_number ~ '^VIR-[0-9]{4}-[0-9]{6}$'),
  source_account_id uuid not null,
  destination_account_id uuid not null,
  amount bigint not null check (amount > 0),
  source_currency text not null default 'FCFA',
  destination_currency text not null default 'FCFA',
  exchange_rate numeric(12,6) not null default 1.0 check (exchange_rate > 0),
  converted_amount bigint not null check (converted_amount > 0),
  status text not null default 'COMPLETED' check (status in ('COMPLETED', 'CANCELLED')),
  notes text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (source_account_id, tenant_id) references public.couture_treasury_accounts(id, tenant_id) on delete restrict,
  foreign key (destination_account_id, tenant_id) references public.couture_treasury_accounts(id, tenant_id) on delete restrict,
  unique (tenant_id, transfer_number),
  unique (id, tenant_id)
);

create index if not exists couture_treasury_transfers_tenant_idx
  on public.couture_treasury_transfers (tenant_id, created_at desc);

-- 4. Table du Plan Comptable SYSCOHADA Révisé
create table if not exists public.couture_chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  account_number text not null check (account_number ~ '^[1-9][0-9]{1,5}$'),
  account_name text not null check (char_length(trim(account_name)) between 2 and 160),
  account_class integer not null check (account_class between 1 and 9),
  account_type text not null check (account_type in ('ASSET', 'LIABILITY', 'EQUITY', 'EXPENSE', 'REVENUE', 'OFF_BALANCE')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, account_number),
  unique (id, tenant_id)
);

create index if not exists couture_coa_tenant_idx
  on public.couture_chart_of_accounts (tenant_id, account_number);

-- 5. Table des Journaux Comptables
create table if not exists public.couture_accounting_journals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  code text not null check (code in ('VE', 'AC', 'BQ', 'CA', 'OD', 'PA')),
  name text not null check (char_length(trim(name)) between 2 and 100),
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (id, tenant_id)
);

create index if not exists couture_journals_tenant_idx
  on public.couture_accounting_journals (tenant_id, code);

-- 6. Table des Pièces et Écritures Comptables
create table if not exists public.couture_journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid references public.couture_sites(id) on delete set null,
  entry_number text not null check (entry_number ~ '^ECR-[0-9]{4}-[0-9]{6}$'),
  journal_code text not null check (journal_code in ('VE', 'AC', 'BQ', 'CA', 'OD', 'PA')),
  entry_date date not null default current_date,
  fiscal_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  reference text not null check (char_length(trim(reference)) between 1 and 120),
  description text not null check (char_length(trim(description)) between 2 and 300),
  source_module text check (source_module in ('SALES', 'PURCHASES', 'PETTY_CASH', 'PAYROLL', 'TREASURY', 'MANUAL_OD')),
  source_id uuid,
  currency text not null default 'FCFA',
  total_debit bigint not null default 0 check (total_debit >= 0),
  total_credit bigint not null default 0 check (total_credit >= 0),
  is_balanced boolean not null default true,
  is_posted boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, entry_number),
  unique (id, tenant_id)
);

create index if not exists couture_journal_entries_tenant_idx
  on public.couture_journal_entries (tenant_id, fiscal_year, period_month);

-- 7. Table des Lignes d'Écritures Comptables
create table if not exists public.couture_journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  entry_id uuid not null,
  account_number text not null,
  label text not null check (char_length(trim(label)) between 2 and 240),
  debit_amount bigint not null default 0 check (debit_amount >= 0),
  credit_amount bigint not null default 0 check (credit_amount >= 0),
  currency text not null default 'FCFA',
  amount_in_ref_currency bigint not null default 0 check (amount_in_ref_currency >= 0),
  created_at timestamptz not null default now(),
  foreign key (entry_id, tenant_id) references public.couture_journal_entries(id, tenant_id) on delete cascade,
  unique (id, tenant_id)
);

create index if not exists couture_entry_lines_tenant_idx
  on public.couture_journal_entry_lines (tenant_id, entry_id, account_number);

-- 8. Table des Paramètres de Consolidation Multidevise
create table if not exists public.couture_consolidated_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  reference_currency text not null default 'FCFA',
  is_multisite_consolidation_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

-- 9. Row Level Security & Politiques
alter table public.couture_treasury_accounts enable row level security;
alter table public.couture_treasury_transactions enable row level security;
alter table public.couture_treasury_transfers enable row level security;
alter table public.couture_chart_of_accounts enable row level security;
alter table public.couture_accounting_journals enable row level security;
alter table public.couture_journal_entries enable row level security;
alter table public.couture_journal_entry_lines enable row level security;
alter table public.couture_consolidated_settings enable row level security;

revoke all on public.couture_treasury_accounts,
  public.couture_treasury_transactions,
  public.couture_treasury_transfers,
  public.couture_chart_of_accounts,
  public.couture_accounting_journals,
  public.couture_journal_entries,
  public.couture_journal_entry_lines,
  public.couture_consolidated_settings from anon, authenticated;

grant select on public.couture_treasury_accounts,
  public.couture_treasury_transactions,
  public.couture_treasury_transfers,
  public.couture_chart_of_accounts,
  public.couture_accounting_journals,
  public.couture_journal_entries,
  public.couture_journal_entry_lines,
  public.couture_consolidated_settings to authenticated;

grant select, insert, update, delete on public.couture_treasury_accounts,
  public.couture_treasury_transactions,
  public.couture_treasury_transfers,
  public.couture_chart_of_accounts,
  public.couture_accounting_journals,
  public.couture_journal_entries,
  public.couture_journal_entry_lines,
  public.couture_consolidated_settings to service_role;

drop policy if exists couture_treasury_accounts_select on public.couture_treasury_accounts;
create policy couture_treasury_accounts_select on public.couture_treasury_accounts
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_treasury_tx_select on public.couture_treasury_transactions;
create policy couture_treasury_tx_select on public.couture_treasury_transactions
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_treasury_transfers_select on public.couture_treasury_transfers;
create policy couture_treasury_transfers_select on public.couture_treasury_transfers
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_coa_select on public.couture_chart_of_accounts;
create policy couture_coa_select on public.couture_chart_of_accounts
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_journals_select on public.couture_accounting_journals;
create policy couture_journals_select on public.couture_accounting_journals
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_journal_entries_select on public.couture_journal_entries;
create policy couture_journal_entries_select on public.couture_journal_entries
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_entry_lines_select on public.couture_journal_entry_lines;
create policy couture_entry_lines_select on public.couture_journal_entry_lines
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_consolidated_settings_select on public.couture_consolidated_settings;
create policy couture_consolidated_settings_select on public.couture_consolidated_settings
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
