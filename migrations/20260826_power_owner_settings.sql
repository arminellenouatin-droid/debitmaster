-- DebitManager Power: préférences propriétaire et coffre de credentials MTN MoMo chiffrés côté serveur.
alter table public.companies
  add column if not exists zones_tables_enabled boolean not null default true,
  add column if not exists payment_mode text not null default 'SIMPLE';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_payment_mode_check') then
    alter table public.companies add constraint companies_payment_mode_check check (payment_mode in ('SIMPLE', 'PERSONNEL'));
  end if;
end $$;

create table if not exists public.tenant_momo_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.companies(id) on delete cascade,
  encrypted_payload text not null,
  key_version text not null default 'v1',
  last4_api_user text,
  last4_api_key text,
  last4_collection_key text,
  last4_disbursement_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_momo_credentials_tenant_idx on public.tenant_momo_credentials(tenant_id);
alter table public.tenant_momo_credentials enable row level security;

drop policy if exists tenant_momo_credentials_owner_select on public.tenant_momo_credentials;
create policy tenant_momo_credentials_owner_select on public.tenant_momo_credentials
  for select using (exists (select 1 from public.companies c where c.id = tenant_id and c.owner_user_id = (select auth.uid()) and c.activity_type = 'POWER' and c.deleted_at is null));

drop policy if exists tenant_momo_credentials_owner_insert on public.tenant_momo_credentials;
create policy tenant_momo_credentials_owner_insert on public.tenant_momo_credentials
  for insert with check (exists (select 1 from public.companies c where c.id = tenant_id and c.owner_user_id = (select auth.uid()) and c.activity_type = 'POWER' and c.deleted_at is null));

drop policy if exists tenant_momo_credentials_owner_update on public.tenant_momo_credentials;
create policy tenant_momo_credentials_owner_update on public.tenant_momo_credentials
  for update using (exists (select 1 from public.companies c where c.id = tenant_id and c.owner_user_id = (select auth.uid()) and c.activity_type = 'POWER' and c.deleted_at is null))
  with check (exists (select 1 from public.companies c where c.id = tenant_id and c.owner_user_id = (select auth.uid()) and c.activity_type = 'POWER' and c.deleted_at is null));

drop policy if exists tenant_momo_credentials_owner_delete on public.tenant_momo_credentials;
create policy tenant_momo_credentials_owner_delete on public.tenant_momo_credentials
  for delete using (exists (select 1 from public.companies c where c.id = tenant_id and c.owner_user_id = (select auth.uid()) and c.activity_type = 'POWER' and c.deleted_at is null));
