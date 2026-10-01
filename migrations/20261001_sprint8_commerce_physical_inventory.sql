-- DebitMaster Sprint 8: Inventaires Physiques, Comptages, Écarts et Régularisations de Stock
-- Tables : commerce_inventory_sessions, commerce_inventory_items
-- Respect strict des règles de sécurité AGENTS.md : RLS activée, isolation multi-tenant, transactions atomiques, contrôle d'accès serveur, séparation des tâches.

-- 1. Élargissement des types de documents dans document_sequences pour supporter INVENTORY_SESSION
alter table public.document_sequences drop constraint if exists document_sequences_doc_type_check;
alter table public.document_sequences add constraint document_sequences_doc_type_check
  check (doc_type in (
    'QUOTE', 'INVOICE', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE',
    'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'STOCK_TRANSFER',
    'INVENTORY_SESSION'
  ));

-- 2. Mise à jour de la fonction next_document_number pour supporter INV
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

-- 3. Table des Sessions d'Inventaire Physique
create table if not exists public.commerce_inventory_sessions (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  session_number text not null,
  store_id uuid not null references public.commerce_stores(id) on delete restrict,
  inventory_type text not null default 'GENERAL' check (inventory_type in ('GENERAL', 'PARTIAL', 'CYCLIC')),
  category_id uuid references public.commerce_categories(id) on delete set null,
  status text not null default 'IN_PROGRESS' check (status in ('DRAFT', 'IN_PROGRESS', 'COUNTED', 'VALIDATED', 'CANCELLED')),
  is_blind_count boolean not null default false,
  total_theoretical_value_xof bigint not null default 0,
  total_counted_value_xof bigint not null default 0,
  total_variance_value_xof bigint not null default 0,
  total_items_count integer not null default 0,
  discrepancies_count integer not null default 0,
  notes text,
  started_by_user_id uuid not null references auth.users(id),
  started_at timestamptz not null default now(),
  validated_by_user_id uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_commerce_inv_session unique (tenant_id, session_number)
);

create index if not exists idx_commerce_inv_sessions_tenant on public.commerce_inventory_sessions(tenant_id, status);
create index if not exists idx_commerce_inv_sessions_store on public.commerce_inventory_sessions(store_id);

-- 4. Table des Lignes de Comptage d'Inventaire
create table if not exists public.commerce_inventory_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  session_id uuid not null references public.commerce_inventory_sessions(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  internal_code text,
  unit_cost_xof bigint not null default 0,
  theoretical_quantity numeric(14,3) not null default 0,
  counted_quantity numeric(14,3),
  recounted_quantity numeric(14,3),
  final_quantity numeric(14,3),
  variance_quantity numeric(14,3) default 0,
  variance_amount_xof bigint default 0,
  status text not null default 'PENDING' check (status in ('PENDING', 'MATCHED', 'DISCREPANCY', 'RECOUNTED', 'ADJUSTED')),
  justification text,
  counter_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commerce_inv_items_session on public.commerce_inventory_items(session_id);
create index if not exists idx_commerce_inv_items_product on public.commerce_inventory_items(product_id);

-- 5. Sécurité RLS et politiques multi-tenant
alter table public.commerce_inventory_sessions enable row level security;
alter table public.commerce_inventory_items enable row level security;

revoke all on public.commerce_inventory_sessions from anon;
revoke all on public.commerce_inventory_items from anon;

drop policy if exists "commerce_inv_sessions_tenant" on public.commerce_inventory_sessions;
create policy "commerce_inv_sessions_tenant" on public.commerce_inventory_sessions
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

drop policy if exists "commerce_inv_items_tenant" on public.commerce_inventory_items;
create policy "commerce_inv_items_tenant" on public.commerce_inventory_items
for all to authenticated
using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));
