-- DebitManager: super-administration SaaS et programme d'affiliation.
-- Les paiements d'abonnement sont séparés des paiements de commandes.
begin;

alter table public.companies
  add column if not exists affiliate_id uuid;

create table if not exists public.platform_affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  code varchar(40) not null unique,
  display_name varchar(160) not null,
  commission_rate numeric(5,2) not null default 10.00 check (commission_rate >= 0 and commission_rate <= 100),
  payout_threshold_xof integer not null default 20000 check (payout_threshold_xof >= 20000),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  provider text not null default 'MONEROO' check (provider = 'MONEROO'),
  provider_reference varchar(180) unique,
  plan text not null,
  amount integer not null check (amount > 0),
  currency varchar(8) not null default 'XOF',
  status text not null default 'PENDING' check (status in ('PENDING','SUCCEEDED','FAILED','REFUNDED')),
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.platform_affiliates(id) on delete restrict,
  tenant_id uuid not null unique references public.companies(id) on delete restrict,
  attribution_code varchar(40) not null,
  attributed_at timestamptz not null default now(),
  source text not null default 'REFERRAL_LINK',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.platform_affiliates(id) on delete restrict,
  tenant_id uuid not null references public.companies(id) on delete restrict,
  subscription_payment_id uuid not null unique references public.saas_subscription_payments(id) on delete restrict,
  gross_amount integer not null check (gross_amount > 0),
  commission_rate numeric(5,2) not null check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount integer not null check (commission_amount >= 0),
  currency varchar(8) not null default 'XOF',
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','PAID','REJECTED','REVERSED')),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_payout_requests (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.platform_affiliates(id) on delete restrict,
  amount integer not null check (amount >= 20000),
  currency varchar(8) not null default 'XOF',
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','PAID','REJECTED','CANCELLED')),
  payment_method text not null check (payment_method in ('MOBILE_MONEY','BANK_TRANSFER')),
  payment_account_ref text not null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  payout_reference varchar(180),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_affiliate_idx on public.companies(affiliate_id);
create index if not exists saas_subscription_payments_tenant_idx on public.saas_subscription_payments(tenant_id, status, paid_at desc);
create index if not exists affiliate_commissions_affiliate_idx on public.affiliate_commissions(affiliate_id, status, created_at desc);
create index if not exists affiliate_payout_requests_affiliate_idx on public.affiliate_payout_requests(affiliate_id, status, requested_at desc);

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.user_type = 'SUPER_ADMIN'
      and p.role = 'MASTER_ADMIN'
      and p.status = 'ACTIVE'
      and p.deleted_at is null
  );
$$;

revoke execute on function private.is_platform_admin() from public;
revoke execute on function private.is_platform_admin() from anon;
grant execute on function private.is_platform_admin() to authenticated;

alter table public.companies enable row level security;
drop policy if exists companies_platform_admin_select on public.companies;
drop policy if exists companies_platform_admin_update on public.companies;
create policy companies_platform_admin_select on public.companies
  for select to authenticated
  using (private.is_platform_admin());
create policy companies_platform_admin_update on public.companies
  for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

alter table public.platform_affiliates enable row level security;
create policy platform_affiliates_self_or_master_select on public.platform_affiliates
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());
create policy platform_affiliates_master_insert on public.platform_affiliates
  for insert to authenticated
  with check (private.is_platform_admin());
create policy platform_affiliates_self_update_or_master on public.platform_affiliates
  for update to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin())
  with check (user_id = (select auth.uid()) or private.is_platform_admin());

alter table public.saas_subscription_payments enable row level security;
create policy saas_subscription_payments_master_select on public.saas_subscription_payments
  for select to authenticated
  using (private.is_platform_admin());
create policy saas_subscription_payments_master_write on public.saas_subscription_payments
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

alter table public.affiliate_attributions enable row level security;
create policy affiliate_attributions_self_or_master_select on public.affiliate_attributions
  for select to authenticated
  using (private.is_platform_admin() or exists (
    select 1 from public.platform_affiliates a
    where a.id = affiliate_attributions.affiliate_id and a.user_id = (select auth.uid())
  ));
create policy affiliate_attributions_master_write on public.affiliate_attributions
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

alter table public.affiliate_commissions enable row level security;
create policy affiliate_commissions_self_or_master_select on public.affiliate_commissions
  for select to authenticated
  using (private.is_platform_admin() or exists (
    select 1 from public.platform_affiliates a
    where a.id = affiliate_commissions.affiliate_id and a.user_id = (select auth.uid())
  ));
create policy affiliate_commissions_master_write on public.affiliate_commissions
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

alter table public.affiliate_payout_requests enable row level security;
create policy affiliate_payout_requests_self_or_master_select on public.affiliate_payout_requests
  for select to authenticated
  using (private.is_platform_admin() or exists (
    select 1 from public.platform_affiliates a
    where a.id = affiliate_payout_requests.affiliate_id and a.user_id = (select auth.uid())
  ));
create policy affiliate_payout_requests_self_insert on public.affiliate_payout_requests
  for insert to authenticated
  with check (
    amount >= 20000
    and exists (
      select 1 from public.platform_affiliates a
      where a.id = affiliate_payout_requests.affiliate_id and a.user_id = (select auth.uid()) and a.status = 'ACTIVE'
    )
  );
create policy affiliate_payout_requests_master_update on public.affiliate_payout_requests
  for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

commit;
