-- DebitManager: internal messaging, isolated per tenant and readable/writable only by authorized members.
begin;

create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete set null,
  subject varchar(160),
  body varchar(2000) not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists internal_messages_tenant_created_idx on public.internal_messages(tenant_id, created_at desc);
create index if not exists internal_messages_recipient_idx on public.internal_messages(recipient_user_id, created_at desc);

alter table public.internal_messages enable row level security;

drop policy if exists internal_messages_member_access on public.internal_messages;
create policy internal_messages_member_access on public.internal_messages
  for select to authenticated
  using (
    (
      tenant_id = private.current_tenant_id()
      or exists (
        select 1 from public.companies c
        where c.id = internal_messages.tenant_id
          and c.owner_user_id = (select auth.uid())
          and c.deleted_at is null
      )
    )
    and (
      sender_user_id = (select auth.uid())
      or recipient_user_id = (select auth.uid())
      or exists (
        select 1 from public.employees e
        where e.tenant_id = internal_messages.tenant_id
          and e.user_id = (select auth.uid())
          and e.deleted_at is null
          and e.status = 'ACTIVE'
      )
      or exists (
        select 1 from public.companies c
        where c.id = internal_messages.tenant_id
          and c.owner_user_id = (select auth.uid())
          and c.deleted_at is null
      )
    )
  );

drop policy if exists internal_messages_sender_insert on public.internal_messages;
create policy internal_messages_sender_insert on public.internal_messages
  for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and (
      tenant_id = private.current_tenant_id()
      or exists (
        select 1 from public.companies c
        where c.id = internal_messages.tenant_id
          and c.owner_user_id = (select auth.uid())
          and c.deleted_at is null
      )
    )
  );

commit;
