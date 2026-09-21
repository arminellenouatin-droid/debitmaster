-- DebitMaster: table de stockage des jetons Firebase Cloud Messaging (Web Push Chrome)
-- RLS stricte : acces reserve au proprietaire du token et aux membres autorises de l'etablissement

begin;

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  device_type text not null default 'CHROME_WEB',
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_push_tokens_token_unique unique (token)
);

create index if not exists user_push_tokens_tenant_user_active_idx
  on public.user_push_tokens(tenant_id, user_id)
  where is_active = true;

create index if not exists user_push_tokens_token_idx
  on public.user_push_tokens(token);

alter table public.user_push_tokens enable row level security;

revoke all on public.user_push_tokens from anon;
grant select, insert, update, delete on public.user_push_tokens to authenticated;

drop policy if exists user_push_tokens_select_own on public.user_push_tokens;
create policy user_push_tokens_select_own on public.user_push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_push_tokens_insert_own on public.user_push_tokens;
create policy user_push_tokens_insert_own on public.user_push_tokens
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.companies c
      where c.id = user_push_tokens.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
      union
      select 1 from public.employees e
      where e.tenant_id = user_push_tokens.tenant_id
        and e.user_id = (select auth.uid())
        and e.status = 'ACTIVE'
        and e.deleted_at is null
    )
  );

drop policy if exists user_push_tokens_update_own on public.user_push_tokens;
create policy user_push_tokens_update_own on public.user_push_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_push_tokens_delete_own on public.user_push_tokens;
create policy user_push_tokens_delete_own on public.user_push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

commit;
