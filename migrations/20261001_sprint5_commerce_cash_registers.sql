-- DebitMaster Sprint 5: Caisse, Règlements, Sessions & Clôtures Z
-- Respect strict des règles de sécurité AGENTS.md : RLS, isolation multi-tenant, transactions atomiques

-- 1. Table des Caisses (Cash Registers)
create table if not exists public.cash_registers (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  store_id uuid not null references public.inventory_stores(id) on delete cascade,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_cash_registers_tenant_name unique (tenant_id, name)
);

create index if not exists idx_cash_registers_tenant on public.cash_registers(tenant_id);
create index if not exists idx_cash_registers_store on public.cash_registers(store_id);

alter table public.cash_registers enable row level security;
revoke all on public.cash_registers from anon;

drop policy if exists "cash_registers_tenant_read" on public.cash_registers;
create policy "cash_registers_tenant_read" on public.cash_registers
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "cash_registers_tenant_write" on public.cash_registers;
create policy "cash_registers_tenant_write" on public.cash_registers
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

-- 2. Table des Sessions de Caisse (Ouvertures / Clôtures Z)
create table if not exists public.cash_register_sessions (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  cash_register_id uuid not null references public.cash_registers(id) on delete cascade,
  opened_by_user_id uuid not null references auth.users(id),
  closed_by_user_id uuid references auth.users(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_float numeric not null default 0 check (opening_float >= 0),
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  expected_cash numeric not null default 0 check (expected_cash >= 0),
  closing_cash_counted numeric check (closing_cash_counted is null or closing_cash_counted >= 0),
  cash_difference numeric not null default 0,
  difference_reason text,
  total_collected numeric not null default 0 check (total_collected >= 0),
  total_payments_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cash_sessions_tenant on public.cash_register_sessions(tenant_id);
create index if not exists idx_cash_sessions_register on public.cash_register_sessions(cash_register_id);
create index if not exists idx_cash_sessions_status on public.cash_register_sessions(tenant_id, status);

alter table public.cash_register_sessions enable row level security;
revoke all on public.cash_register_sessions from anon;

drop policy if exists "cash_sessions_tenant_read" on public.cash_register_sessions;
create policy "cash_sessions_tenant_read" on public.cash_register_sessions
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "cash_sessions_tenant_write" on public.cash_register_sessions;
create policy "cash_sessions_tenant_write" on public.cash_register_sessions
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

-- 3. Table des Mouvements de Caisse (Entrées / Sorties diverses, Dépenses, Dépôts en banque)
create table if not exists public.cash_movements (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  session_id uuid not null references public.cash_register_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  movement_type text not null check (movement_type in ('CASH_IN', 'CASH_OUT', 'BANK_DEPOSIT', 'EXPENSE')),
  amount numeric not null check (amount > 0),
  reason text not null,
  reference_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_movements_session on public.cash_movements(session_id);
create index if not exists idx_cash_movements_tenant on public.cash_movements(tenant_id);

alter table public.cash_movements enable row level security;
revoke all on public.cash_movements from anon;

drop policy if exists "cash_movements_tenant_read" on public.cash_movements;
create policy "cash_movements_tenant_read" on public.cash_movements
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "cash_movements_tenant_write" on public.cash_movements;
create policy "cash_movements_tenant_write" on public.cash_movements
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

-- 4. Table des Paiements de Commandes / Factures (Order Payments)
create table if not exists public.order_payments (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  session_id uuid references public.cash_register_sessions(id) on delete set null,
  cashier_user_id uuid not null references auth.users(id),
  payment_method text not null check (payment_method in ('CASH', 'MTN_MOMO', 'MOOV_MONEY', 'ORANGE_MONEY', 'WAVE', 'CARD', 'CHECK', 'TRANSFER', 'CREDIT')),
  amount numeric not null check (amount > 0),
  currency text not null default 'XOF',
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_payments_order on public.order_payments(order_id);
create index if not exists idx_order_payments_session on public.order_payments(session_id);
create index if not exists idx_order_payments_tenant on public.order_payments(tenant_id);

alter table public.order_payments enable row level security;
revoke all on public.order_payments from anon;

drop policy if exists "order_payments_tenant_read" on public.order_payments;
create policy "order_payments_tenant_read" on public.order_payments
for select
to authenticated
using (
  tenant_id in (
    select id from public.companies where owner_user_id = (select auth.uid())
    union
    select tenant_id from public.employees where user_id = (select auth.uid()) and status = 'ACTIVE'
  )
);

drop policy if exists "order_payments_tenant_write" on public.order_payments;
create policy "order_payments_tenant_write" on public.order_payments
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

-- 5. Enrichissement de la table orders pour le suivi du paiement et statut
alter table public.orders add column if not exists amount_paid numeric not null default 0 check (amount_paid >= 0);
alter table public.orders add column if not exists payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'));
