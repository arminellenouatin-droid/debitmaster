-- DebitMaster Sprint 4: Devis, Proformas et Facturation Commerce
-- Tables: quotes, quote_items, document_sequences
-- Respect strict des règles de sécurité AGENTS.md : RLS, isolation multi-tenant, transactions atomiques

-- 1. Table des séquences de numérotation sans trou
create table if not exists public.document_sequences (
  tenant_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null check (doc_type in ('QUOTE', 'INVOICE', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE')),
  year int not null,
  current_number int not null default 0,
  primary key (tenant_id, doc_type, year)
);

alter table public.document_sequences enable row level security;
revoke all on public.document_sequences from anon, authenticated;

-- 2. Fonction atomique d'incrément de numérotation séquentielle
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

-- 3. Table des Devis (Quotes)
create table if not exists public.quotes (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  quote_number text not null,
  quote_type text not null default 'STANDARD' check (quote_type in ('STANDARD', 'PROFORMA')),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null default 'Client comptoir',
  customer_phone text,
  seller_user_id uuid not null references auth.users(id),
  seller_name text,
  store_id uuid references public.inventory_stores(id) on delete set null,
  status text not null default 'PENDING' check (status in ('DRAFT', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED')),
  valid_until timestamptz not null default (now() + interval '15 days'),
  subtotal_amount numeric not null default 0 check (subtotal_amount >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  discount_amount numeric not null default 0 check (discount_amount >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  currency text not null default 'XOF',
  notes text,
  terms text,
  converted_order_id uuid references public.orders(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_quotes_number unique (tenant_id, quote_number)
);

create index if not exists idx_quotes_tenant on public.quotes(tenant_id);
create index if not exists idx_quotes_seller on public.quotes(tenant_id, seller_user_id);
create index if not exists idx_quotes_customer on public.quotes(tenant_id, customer_id);
create index if not exists idx_quotes_status on public.quotes(tenant_id, status);

alter table public.quotes enable row level security;
revoke all on public.quotes from anon;

-- Politiques RLS pour les Devis
drop policy if exists "quotes_tenant_read" on public.quotes;
create policy "quotes_tenant_read" on public.quotes
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "quotes_tenant_write" on public.quotes;
create policy "quotes_tenant_write" on public.quotes
for all
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
)
with check (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

-- 4. Table des Lignes de Devis (Quote Items)
create table if not exists public.quote_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null default 'unité',
  unit_price numeric not null check (unit_price >= 0),
  discount_percent numeric not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  tax_rate numeric not null default 0 check (tax_rate >= 0),
  total_price numeric not null check (total_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_items_quote on public.quote_items(quote_id);
create index if not exists idx_quote_items_product on public.quote_items(product_id);
create index if not exists idx_quote_items_tenant on public.quote_items(tenant_id);

alter table public.quote_items enable row level security;
revoke all on public.quote_items from anon;

-- Politiques RLS pour les Lignes de Devis
drop policy if exists "quote_items_tenant_read" on public.quote_items;
create policy "quote_items_tenant_read" on public.quote_items
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "quote_items_tenant_write" on public.quote_items;
create policy "quote_items_tenant_write" on public.quote_items
for all
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
)
with check (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

-- 5. Enrichir la table orders pour la facturation commerce (numéro de facture séquentiel, type de document)
alter table public.orders add column if not exists invoice_number text;
alter table public.orders add column if not exists document_type text not null default 'INVOICE';
alter table public.orders add column if not exists tax_amount numeric not null default 0;
alter table public.orders add column if not exists discount_amount numeric not null default 0;
alter table public.orders add column if not exists quote_id uuid references public.quotes(id) on delete set null;

create index if not exists idx_orders_invoice_number on public.orders(tenant_id, invoice_number);
