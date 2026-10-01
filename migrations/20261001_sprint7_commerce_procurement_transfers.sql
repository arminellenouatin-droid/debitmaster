-- DebitMaster Sprint 7: Approvisionnement complet, Espace Chargé des approvisionnements et Transferts inter-magasins
-- Tables : purchase_requests, purchase_request_items, purchase_orders, purchase_order_items, goods_receipts, goods_receipt_items, commerce_transfers, commerce_transfer_items
-- Respect strict des règles de sécurité AGENTS.md : RLS activée, isolation multi-tenant, transactions atomiques, contrôle d'accès serveur.

-- 1. Élargissement des types de documents dans document_sequences
alter table public.document_sequences drop constraint if exists document_sequences_doc_type_check;
alter table public.document_sequences add constraint document_sequences_doc_type_check
  check (doc_type in ('QUOTE', 'INVOICE', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE', 'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'STOCK_TRANSFER'));

-- 2. Mise à jour de la fonction next_document_number pour supporter les DA, BC, BR et TRF
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

-- 3. Table des Demandes d'Achat (DA)
create table if not exists public.purchase_requests (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  request_number text not null,
  requested_by_user_id uuid not null references auth.users(id),
  store_id uuid references public.commerce_stores(id) on delete set null,
  supplier_id uuid references public.commerce_suppliers(id) on delete set null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CONVERTED')),
  priority text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'URGENT')),
  total_estimated_amount_xof bigint not null default 0,
  notes text,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, request_number)
);

create index if not exists idx_purchase_requests_tenant_status on public.purchase_requests (tenant_id, status);

create table if not exists public.purchase_request_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  quantity_requested numeric(14,3) not null check (quantity_requested > 0),
  estimated_unit_price_xof bigint not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_request_items_request on public.purchase_request_items (request_id);

alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;

create policy "purchase_requests_tenant_isolation" on public.purchase_requests
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

create policy "purchase_request_items_tenant_isolation" on public.purchase_request_items
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

-- 4. Table des Commandes Fournisseur (BC)
create table if not exists public.purchase_orders (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  order_number text not null,
  supplier_id uuid not null references public.commerce_suppliers(id) on delete restrict,
  store_id uuid references public.commerce_stores(id) on delete set null,
  purchase_request_id uuid references public.purchase_requests(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
  total_subtotal_xof bigint not null default 0,
  landed_costs_xof bigint not null default 0,
  total_tax_xof bigint not null default 0,
  total_amount_xof bigint not null default 0,
  payment_terms text,
  expected_delivery_date date,
  notes text,
  created_by_user_id uuid not null references auth.users(id),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, order_number)
);

create index if not exists idx_purchase_orders_tenant_status on public.purchase_orders (tenant_id, status);

create table if not exists public.purchase_order_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  quantity_ordered numeric(14,3) not null check (quantity_ordered > 0),
  quantity_received numeric(14,3) not null default 0 check (quantity_received >= 0),
  unit_price_xof bigint not null check (unit_price_xof >= 0),
  tax_rate_basis_points integer not null default 0,
  total_line_xof bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_order_items_order on public.purchase_order_items (purchase_order_id);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy "purchase_orders_tenant_isolation" on public.purchase_orders
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

create policy "purchase_order_items_tenant_isolation" on public.purchase_order_items
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

-- 5. Table des Bons de Réception Fournisseur (BR & Rapprochement 3-voies)
create table if not exists public.goods_receipts (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  receipt_number text not null,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  supplier_id uuid not null references public.commerce_suppliers(id) on delete restrict,
  store_id uuid not null references public.commerce_stores(id) on delete restrict,
  supplier_invoice_ref text,
  received_by_user_id uuid not null references auth.users(id),
  status text not null default 'CONFIRMED' check (status in ('CONFIRMED', 'CANCELLED')),
  landed_costs_applied_xof bigint not null default 0,
  notes text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, receipt_number)
);

create index if not exists idx_goods_receipts_tenant_order on public.goods_receipts (tenant_id, purchase_order_id);

create table if not exists public.goods_receipt_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  goods_receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  quantity_received numeric(14,3) not null check (quantity_received > 0),
  unit_cost_xof bigint not null check (unit_cost_xof >= 0),
  total_cost_xof bigint not null check (total_cost_xof >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_goods_receipt_items_receipt on public.goods_receipt_items (goods_receipt_id);

alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;

create policy "goods_receipts_tenant_isolation" on public.goods_receipts
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

create policy "goods_receipt_items_tenant_isolation" on public.goods_receipt_items
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

-- 6. Table des Transferts Inter-Magasins
create table if not exists public.commerce_transfers (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  transfer_number text not null,
  source_store_id uuid not null references public.commerce_stores(id) on delete restrict,
  destination_store_id uuid not null references public.commerce_stores(id) on delete restrict,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED')),
  requested_by_user_id uuid not null references auth.users(id),
  shipped_by_user_id uuid references auth.users(id) on delete set null,
  shipped_at timestamptz,
  received_by_user_id uuid references auth.users(id) on delete set null,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_store_id <> destination_store_id),
  unique (tenant_id, transfer_number)
);

create index if not exists idx_commerce_transfers_tenant on public.commerce_transfers (tenant_id, status);

create table if not exists public.commerce_transfer_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  transfer_id uuid not null references public.commerce_transfers(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  quantity_requested numeric(14,3) not null check (quantity_requested > 0),
  quantity_shipped numeric(14,3) not null default 0 check (quantity_shipped >= 0),
  quantity_received numeric(14,3) not null default 0 check (quantity_received >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_commerce_transfer_items_transfer on public.commerce_transfer_items (transfer_id);

alter table public.commerce_transfers enable row level security;
alter table public.commerce_transfer_items enable row level security;

create policy "commerce_transfers_tenant_isolation" on public.commerce_transfers
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));

create policy "commerce_transfer_items_tenant_isolation" on public.commerce_transfer_items
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = (select auth.uid())));
