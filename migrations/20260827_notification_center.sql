-- DebitManager: notification center with deep links and permission-aware action mode.
begin;

alter table public.internal_messages
  add column if not exists event_type text,
  add column if not exists entity_id uuid,
  add column if not exists action_path text,
  add column if not exists action_permission text,
  add column if not exists operator_user_id uuid references auth.users(id) on delete set null,
  add column if not exists dedupe_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists internal_messages_dedupe_idx
  on public.internal_messages(tenant_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists internal_messages_recipient_unread_idx
  on public.internal_messages(recipient_user_id, read_at, created_at desc);

create index if not exists internal_messages_entity_idx
  on public.internal_messages(tenant_id, entity_id, created_at desc);

 drop policy if exists internal_messages_recipient_update on public.internal_messages;
create policy internal_messages_recipient_update on public.internal_messages
  for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

alter table public.internal_messages drop constraint if exists internal_messages_action_path_check;
alter table public.internal_messages add constraint internal_messages_action_path_check
  check (action_path is null or action_path like '/%');

commit;
