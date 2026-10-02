-- DebitMaster: Sprint 4 pour l'activité « Atelier de couture ».
-- Encaissement comptoir multidevise (FCFA/USD/EUR) et intégration Mobile Money & TPE.
begin;

-- 1. Table des Taux de Change Quotidiens par Établissement
create table if not exists public.couture_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  currency text not null check (currency in ('USD', 'EUR')),
  rate_to_fcfa numeric(14,6) not null check (rate_to_fcfa > 0),
  effective_date date not null default current_date,
  source text not null default 'OFFICIAL',
  created_at timestamptz not null default now(),
  unique (tenant_id, currency, effective_date)
);

create index if not exists couture_exchange_rates_tenant_date_idx
  on public.couture_exchange_rates (tenant_id, effective_date desc);

-- 2. Extension de la table couture_sale_payments pour le multidevise et terminaux
alter table public.couture_sale_payments
  add column if not exists cash_breakdown jsonb,
  add column if not exists mobile_money_phone text,
  add column if not exists mobile_money_provider text check (mobile_money_provider in ('MTN', 'MOOV', 'ORANGE', 'WAVE')),
  add column if not exists mobile_money_status text check (mobile_money_status in ('PENDING', 'SUCCESSFUL', 'FAILED')),
  add column if not exists tpe_reference text,
  add column if not exists tpe_terminal_id text;

-- 3. Table des Demandes de Paiement Mobile Money
create table if not exists public.couture_mobile_money_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  sale_id uuid not null,
  site_id uuid not null references public.couture_sites(id) on delete restrict,
  phone text not null check (char_length(trim(phone)) between 8 and 30),
  provider text not null check (provider in ('MTN', 'MOOV', 'ORANGE', 'WAVE')),
  amount_xof bigint not null check (amount_xof > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED')),
  provider_transaction_id text,
  initiated_by uuid references auth.users(id) on delete set null,
  initiated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  foreign key (sale_id, tenant_id) references public.couture_sales(id, tenant_id) on delete cascade,
  unique (id, tenant_id)
);

create index if not exists couture_momo_tenant_sale_idx
  on public.couture_mobile_money_requests (tenant_id, sale_id);

-- 4. Row Level Security & Politiques
alter table public.couture_exchange_rates enable row level security;
alter table public.couture_mobile_money_requests enable row level security;

revoke all on public.couture_exchange_rates, public.couture_mobile_money_requests from anon, authenticated;

grant select on public.couture_exchange_rates, public.couture_mobile_money_requests to authenticated;
grant select, insert, update, delete on public.couture_exchange_rates, public.couture_mobile_money_requests to service_role;

drop policy if exists couture_exchange_rates_select on public.couture_exchange_rates;
create policy couture_exchange_rates_select on public.couture_exchange_rates
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_mobile_money_requests_select on public.couture_mobile_money_requests;
create policy couture_mobile_money_requests_select on public.couture_mobile_money_requests
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
