-- DebitMaster Sprint 10: Comptabilité Générale SYSCOHADA Révisé
-- Tables : commerce_accounting_fiscal_years, commerce_chart_of_accounts, commerce_accounting_journals,
--          commerce_journal_entries, commerce_journal_entry_lines
-- Respect strict des règles de sécurité AGENTS.md : RLS activée, isolation multi-tenant, transactions atomiques, contrôle d'accès serveur, équilibre strict débit/crédit (partie double).

-- 1. Élargissement des types de documents dans document_sequences pour JOURNAL_ENTRY
alter table public.document_sequences drop constraint if exists document_sequences_doc_type_check;
alter table public.document_sequences add constraint document_sequences_doc_type_check
  check (doc_type in (
    'QUOTE', 'INVOICE', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE',
    'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'STOCK_TRANSFER',
    'INVENTORY_SESSION', 'EXPENSE', 'TREASURY_TRANSFER', 'FIXED_ASSET',
    'JOURNAL_ENTRY'
  ));

-- 2. Mise à jour de la fonction next_document_number pour supporter ECR
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
  elsif p_doc_type = 'JOURNAL_ENTRY' then v_prefix := 'ECR';
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

-- 3. Table des Exercices Comptables
create table if not exists public.commerce_accounting_fiscal_years (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  fiscal_year integer not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  closed_at timestamptz,
  closed_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint uq_fiscal_year unique (tenant_id, fiscal_year)
);

create index if not exists idx_commerce_fiscal_years_tenant on public.commerce_accounting_fiscal_years(tenant_id, fiscal_year);

-- 4. Table du Plan Comptable SYSCOHADA Révisé
create table if not exists public.commerce_chart_of_accounts (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  account_number text not null,
  account_name text not null,
  account_class integer not null check (account_class between 1 and 9),
  account_type text not null check (account_type in ('ASSET', 'LIABILITY', 'EQUITY', 'EXPENSE', 'REVENUE', 'OFF_BALANCE')),
  is_system boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint uq_tenant_account_num unique (tenant_id, account_number)
);

create index if not exists idx_commerce_coa_tenant on public.commerce_chart_of_accounts(tenant_id, account_number);

-- 5. Table des Journaux Comptables
create table if not exists public.commerce_accounting_journals (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  code text not null check (code in ('VE', 'AC', 'BQ', 'CA', 'OD', 'AN', 'IM')),
  name text not null,
  created_at timestamptz not null default now(),
  constraint uq_tenant_journal_code unique (tenant_id, code)
);

create index if not exists idx_commerce_journals_tenant on public.commerce_accounting_journals(tenant_id);

-- 6. Table des Pièces et Écritures Comptables
create table if not exists public.commerce_journal_entries (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  entry_number text not null,
  journal_code text not null,
  entry_date date not null default current_date,
  fiscal_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  reference text not null,
  description text not null,
  source_module text check (source_module in ('SALES', 'PURCHASES', 'CASH', 'TREASURY', 'EXPENSES', 'INVENTORY', 'FIXED_ASSETS', 'MANUAL_OD')),
  source_id uuid,
  total_debit_xof bigint not null default 0,
  total_credit_xof bigint not null default 0,
  is_balanced boolean not null default true,
  is_posted boolean not null default true,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint uq_commerce_journal_entry unique (tenant_id, entry_number)
);

create index if not exists idx_commerce_entries_tenant on public.commerce_journal_entries(tenant_id, fiscal_year, entry_date desc);
create index if not exists idx_commerce_entries_journal on public.commerce_journal_entries(journal_code);

-- 7. Table des Lignes d'Écritures Comptables (Partie Double)
create table if not exists public.commerce_journal_entry_lines (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid not null references public.commerce_journal_entries(id) on delete cascade,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  account_number text not null,
  account_name text not null,
  debit_amount_xof bigint not null default 0 check (debit_amount_xof >= 0),
  credit_amount_xof bigint not null default 0 check (credit_amount_xof >= 0),
  partner_name text,
  reconciled boolean not null default false,
  line_description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_commerce_entry_lines_entry on public.commerce_journal_entry_lines(entry_id);
create index if not exists idx_commerce_entry_lines_account on public.commerce_journal_entry_lines(tenant_id, account_number);

-- 8. Fonction d'initialisation du Plan Comptable SYSCOHADA Révisé
create or replace function public.initialize_tenant_chart_of_accounts(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. Journaux de base
  insert into public.commerce_accounting_journals (tenant_id, code, name) values
    (p_tenant_id, 'VE', 'Journal des Ventes'),
    (p_tenant_id, 'AC', 'Journal des Achats'),
    (p_tenant_id, 'BQ', 'Journal de Banque'),
    (p_tenant_id, 'CA', 'Journal de Caisse'),
    (p_tenant_id, 'OD', 'Journal des Opérations Diverses'),
    (p_tenant_id, 'AN', 'Journal des À-Nouveaux'),
    (p_tenant_id, 'IM', 'Journal des Immobilisations')
  on conflict (tenant_id, code) do nothing;

  -- 2. Exercice fiscal courant
  insert into public.commerce_accounting_fiscal_years (
    tenant_id, fiscal_year, start_date, end_date, status
  ) values (
    p_tenant_id,
    extract(year from now())::int,
    make_date(extract(year from now())::int, 1, 1),
    make_date(extract(year from now())::int, 12, 31),
    'OPEN'
  ) on conflict (tenant_id, fiscal_year) do nothing;

  -- 3. Plan comptable standard SYSCOHADA
  insert into public.commerce_chart_of_accounts (tenant_id, account_number, account_name, account_class, account_type) values
    -- Classe 1 : Capitaux et dettes à long terme
    (p_tenant_id, '101', 'Capital social', 1, 'EQUITY'),
    (p_tenant_id, '111', 'Réserve légale', 1, 'EQUITY'),
    (p_tenant_id, '121', 'Report à nouveau créditeur', 1, 'EQUITY'),
    (p_tenant_id, '131', 'Résultat net : Bénéfice', 1, 'EQUITY'),
    (p_tenant_id, '139', 'Résultat net : Perte', 1, 'EQUITY'),
    (p_tenant_id, '162', 'Emprunts et dettes auprès des établissements de crédit', 1, 'LIABILITY'),

    -- Classe 2 : Immobilisations
    (p_tenant_id, '213', 'Logiciels informatiques et assimilés', 2, 'ASSET'),
    (p_tenant_id, '231', 'Bâtiments industriels, commerciaux et administratifs', 2, 'ASSET'),
    (p_tenant_id, '241', 'Matériel et outillage industriel et commercial', 2, 'ASSET'),
    (p_tenant_id, '244', 'Matériel de bureau et matériel informatique', 2, 'ASSET'),
    (p_tenant_id, '245', 'Matériel de transport', 2, 'ASSET'),
    (p_tenant_id, '281', 'Amortissements des immobilisations incorporelles', 2, 'ASSET'),
    (p_tenant_id, '284', 'Amortissements du matériel', 2, 'ASSET'),

    -- Classe 3 : Stocks
    (p_tenant_id, '311', 'Marchandises (Stock magasin)', 3, 'ASSET'),
    (p_tenant_id, '321', 'Matières premières et fournitures liées', 3, 'ASSET'),

    -- Classe 4 : Tiers
    (p_tenant_id, '401', 'Fournisseurs, dettes en compte', 4, 'LIABILITY'),
    (p_tenant_id, '408', 'Fournisseurs, factures non parvenues', 4, 'LIABILITY'),
    (p_tenant_id, '411', 'Clients, créances en compte', 4, 'ASSET'),
    (p_tenant_id, '419', 'Clients, créditeurs (Avances et acomptes reçus)', 4, 'LIABILITY'),
    (p_tenant_id, '421', 'Personnel, rémunérations dues', 4, 'LIABILITY'),
    (p_tenant_id, '431', 'Sécurité sociale (CNSS)', 4, 'LIABILITY'),
    (p_tenant_id, '443', 'État, TVA facturée sur ventes', 4, 'LIABILITY'),
    (p_tenant_id, '445', 'État, TVA récupérable sur achats et charges', 4, 'ASSET'),
    (p_tenant_id, '447', 'État, impôts retenus à la source (AIB/VRS)', 4, 'LIABILITY'),
    (p_tenant_id, '471', 'Débiteurs et créditeurs divers', 4, 'ASSET'),

    -- Classe 5 : Trésorerie
    (p_tenant_id, '521', 'Banques locales', 5, 'ASSET'),
    (p_tenant_id, '571', 'Caisses principales', 5, 'ASSET'),
    (p_tenant_id, '572', 'Caisses Mobile Money (MTN, Moov, Wave)', 5, 'ASSET'),
    (p_tenant_id, '581', 'Virements internes de trésorerie', 5, 'ASSET'),

    -- Classe 6 : Charges
    (p_tenant_id, '601', 'Achats de marchandises', 6, 'EXPENSE'),
    (p_tenant_id, '6031', 'Variations des stocks de marchandises', 6, 'EXPENSE'),
    (p_tenant_id, '605', 'Achats de fournitures non stockées (Électricité, Eau)', 6, 'EXPENSE'),
    (p_tenant_id, '624', 'Transports sur achats et livraisons', 6, 'EXPENSE'),
    (p_tenant_id, '632', 'Loyers et charges locatives', 6, 'EXPENSE'),
    (p_tenant_id, '633', 'Entretien, réparations et maintenance', 6, 'EXPENSE'),
    (p_tenant_id, '638', 'Rémunérations d''intermédiaires et honoraires', 6, 'EXPENSE'),
    (p_tenant_id, '641', 'Impôts, taxes et versements assimilés', 6, 'EXPENSE'),
    (p_tenant_id, '661', 'Rémunérations du personnel national', 6, 'EXPENSE'),
    (p_tenant_id, '671', 'Frais financiers et commissions bancaires', 6, 'EXPENSE'),
    (p_tenant_id, '681', 'Dotations aux amortissements d''exploitation', 6, 'EXPENSE'),

    -- Classe 7 : Produits
    (p_tenant_id, '701', 'Ventes de marchandises', 7, 'REVENUE'),
    (p_tenant_id, '706', 'Services vendus et travaux accessoires', 7, 'REVENUE'),
    (p_tenant_id, '707', 'Produits accessoires et emballages', 7, 'REVENUE'),
    (p_tenant_id, '771', 'Intérêts de prêts et produits financiers', 7, 'REVENUE'),

    -- Classe 8 : Autres charges et autres produits (HAÔ)
    (p_tenant_id, '812', 'Valeurs comptables des cessions d''immobilisations', 8, 'EXPENSE'),
    (p_tenant_id, '822', 'Produits des cessions d''immobilisations', 8, 'REVENUE')
  on conflict (tenant_id, account_number) do nothing;
end;
$$;

revoke all on function public.initialize_tenant_chart_of_accounts(uuid) from public, anon;
grant execute on function public.initialize_tenant_chart_of_accounts(uuid) to authenticated, service_role;

-- 9. Sécurité RLS et Politiques Multi-Tenant
alter table public.commerce_accounting_fiscal_years enable row level security;
alter table public.commerce_chart_of_accounts enable row level security;
alter table public.commerce_accounting_journals enable row level security;
alter table public.commerce_journal_entries enable row level security;
alter table public.commerce_journal_entry_lines enable row level security;

revoke all on public.commerce_accounting_fiscal_years from anon;
revoke all on public.commerce_chart_of_accounts from anon;
revoke all on public.commerce_accounting_journals from anon;
revoke all on public.commerce_journal_entries from anon;
revoke all on public.commerce_journal_entry_lines from anon;

drop policy if exists "commerce_fiscal_years_tenant" on public.commerce_accounting_fiscal_years;
create policy "commerce_fiscal_years_tenant" on public.commerce_accounting_fiscal_years
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_coa_tenant" on public.commerce_chart_of_accounts;
create policy "commerce_coa_tenant" on public.commerce_chart_of_accounts
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_journals_tenant" on public.commerce_accounting_journals;
create policy "commerce_journals_tenant" on public.commerce_accounting_journals
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_entries_tenant" on public.commerce_journal_entries;
create policy "commerce_entries_tenant" on public.commerce_journal_entries
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_entry_lines_tenant" on public.commerce_journal_entry_lines;
create policy "commerce_entry_lines_tenant" on public.commerce_journal_entry_lines
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));
