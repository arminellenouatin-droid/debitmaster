-- DebitMaster: état définitif du catalogue et demande de cotation spéciale.
-- La purge ciblée des établissements de test a été appliquée le 22/09/2026 dans une transaction.
-- Conservation : SUPER_ADMIN, platform_affiliates et LE TEMPLE DU PLAISIR.
begin;

create table if not exists public.subscription_quote_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_activities text[] not null default '{}',
  notes text,
  status text not null default 'PENDING' check (status in ('PENDING','QUOTED','ACCEPTED','REJECTED','CANCELLED')),
  quoted_amount integer,
  currency varchar(12) not null default 'XOF',
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscription_quote_requests_tenant_idx on public.subscription_quote_requests(tenant_id, created_at desc);
alter table public.subscription_quote_requests enable row level security;
drop policy if exists subscription_quote_requests_owner_select on public.subscription_quote_requests;
create policy subscription_quote_requests_owner_select on public.subscription_quote_requests for select to authenticated using (requested_by = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.user_type = 'SUPER_ADMIN'));
drop policy if exists subscription_quote_requests_owner_insert on public.subscription_quote_requests;
create policy subscription_quote_requests_owner_insert on public.subscription_quote_requests for insert to authenticated with check (requested_by = (select auth.uid()) and exists (select 1 from public.companies c where c.id = tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null));

-- Les contraintes de codes sont définies par la migration replace_legacy_plan_codes_20260922.
update public.companies set activity_type = 'HOTEL_AUBERGE', subscription_plan = 'SPECIAL', subscription_updated_at = now(), updated_at = now() where id = 'f6afa300-7e9e-4891-b7f6-27ab69fc42d7';
commit;
