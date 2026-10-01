-- DebitMaster Sprint 6: Livraisons, Bons de Livraison (BL), Sorties Magasinier, Retours & Avoirs
-- Respect strict des règles de sécurité AGENTS.md : RLS, isolation multi-tenant, transactions atomiques

-- 1. Table des Bons de Livraison (Delivery Notes)
create table if not exists public.delivery_notes (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  delivery_number text not null,
  store_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null default 'Client comptoir',
  status text not null default 'PENDING' check (status in ('PENDING', 'PREPARED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED')),
  pickup_code text,
  recipient_name text,
  recipient_signature text,
  delivered_by_user_id uuid references auth.users(id),
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_delivery_notes_number unique (tenant_id, delivery_number)
);

create index if not exists idx_delivery_notes_tenant on public.delivery_notes(tenant_id);
create index if not exists idx_delivery_notes_order on public.delivery_notes(order_id);
create index if not exists idx_delivery_notes_store on public.delivery_notes(store_id);
create index if not exists idx_delivery_notes_status on public.delivery_notes(tenant_id, status);

alter table public.delivery_notes enable row level security;
revoke all on public.delivery_notes from anon;

drop policy if exists "delivery_notes_tenant_read" on public.delivery_notes;
create policy "delivery_notes_tenant_read" on public.delivery_notes
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "delivery_notes_tenant_write" on public.delivery_notes;
create policy "delivery_notes_tenant_write" on public.delivery_notes
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

-- 2. Table des Lignes de Bons de Livraison (Delivery Note Items)
create table if not exists public.delivery_note_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  delivery_note_id uuid not null references public.delivery_notes(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  quantity_ordered numeric not null check (quantity_ordered > 0),
  quantity_delivered numeric not null default 0 check (quantity_delivered >= 0),
  unit text not null default 'unité',
  created_at timestamptz not null default now()
);

create index if not exists idx_dn_items_dn on public.delivery_note_items(delivery_note_id);
create index if not exists idx_dn_items_product on public.delivery_note_items(product_id);
create index if not exists idx_dn_items_tenant on public.delivery_note_items(tenant_id);

alter table public.delivery_note_items enable row level security;
revoke all on public.delivery_note_items from anon;

drop policy if exists "dn_items_tenant_read" on public.delivery_note_items;
create policy "dn_items_tenant_read" on public.delivery_note_items
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "dn_items_tenant_write" on public.delivery_note_items;
create policy "dn_items_tenant_write" on public.delivery_note_items
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

-- 3. Table des Retours Marchandises Clients (Customer Returns)
create table if not exists public.customer_returns (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  return_number text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null default 'Client comptoir',
  store_id uuid,
  processed_by_user_id uuid not null references auth.users(id),
  status text not null default 'COMPLETED' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  return_reason text not null,
  total_refund_amount numeric not null default 0 check (total_refund_amount >= 0),
  credit_note_id uuid,
  created_at timestamptz not null default now(),
  constraint uq_customer_returns_number unique (tenant_id, return_number)
);

create index if not exists idx_cust_returns_tenant on public.customer_returns(tenant_id);
create index if not exists idx_cust_returns_order on public.customer_returns(order_id);

alter table public.customer_returns enable row level security;
revoke all on public.customer_returns from anon;

drop policy if exists "cust_returns_tenant_read" on public.customer_returns;
create policy "cust_returns_tenant_read" on public.customer_returns
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "cust_returns_tenant_write" on public.customer_returns;
create policy "cust_returns_tenant_write" on public.customer_returns
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

-- 4. Table des Lignes de Retours (Customer Return Items)
create table if not exists public.customer_return_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  return_id uuid not null references public.customer_returns(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  total_price numeric not null check (total_price >= 0),
  condition text not null default 'RESTOCKED' check (condition in ('RESTOCKED', 'SCRAPPED')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ret_items_ret on public.customer_return_items(return_id);
create index if not exists idx_ret_items_product on public.customer_return_items(product_id);

alter table public.customer_return_items enable row level security;
revoke all on public.customer_return_items from anon;

drop policy if exists "ret_items_tenant_read" on public.customer_return_items;
create policy "ret_items_tenant_read" on public.customer_return_items
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "ret_items_tenant_write" on public.customer_return_items;
create policy "ret_items_tenant_write" on public.customer_return_items
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

-- 5. Table des Factures d'Avoir (Credit Notes)
create table if not exists public.credit_notes (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  credit_note_number text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  return_id uuid references public.customer_returns(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null default 'Client comptoir',
  amount numeric not null check (amount > 0),
  currency text not null default 'XOF',
  reason text not null,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint uq_credit_notes_number unique (tenant_id, credit_note_number)
);

create index if not exists idx_credit_notes_tenant on public.credit_notes(tenant_id);
create index if not exists idx_credit_notes_order on public.credit_notes(order_id);

alter table public.credit_notes enable row level security;
revoke all on public.credit_notes from anon;

drop policy if exists "credit_notes_tenant_read" on public.credit_notes;
create policy "credit_notes_tenant_read" on public.credit_notes
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "credit_notes_tenant_write" on public.credit_notes;
create policy "credit_notes_tenant_write" on public.credit_notes
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
