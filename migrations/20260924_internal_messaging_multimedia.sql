-- DebitMaster: private multi-format internal messaging, tenant-scoped.
begin;

alter table public.internal_messages
  alter column body drop not null,
  add column if not exists message_type text not null default 'TEXT',
  add column if not exists media_path text,
  add column if not exists media_name varchar(255),
  add column if not exists media_mime_type varchar(120),
  add column if not exists media_size integer,
  add column if not exists delivered_at timestamptz;

alter table public.internal_messages drop constraint if exists internal_messages_message_type_check;
alter table public.internal_messages add constraint internal_messages_message_type_check
  check (message_type in ('TEXT', 'AUDIO', 'DOCUMENT', 'IMAGE', 'VIDEO'));
alter table public.internal_messages drop constraint if exists internal_messages_content_check;
alter table public.internal_messages add constraint internal_messages_content_check
  check (coalesce(length(trim(body)), 0) > 0 or media_path is not null);

create index if not exists internal_messages_conversation_idx
  on public.internal_messages(tenant_id, sender_user_id, recipient_user_id, created_at desc);
create index if not exists internal_messages_media_idx
  on public.internal_messages(tenant_id, media_path)
  where media_path is not null;

alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.employees add column if not exists last_seen_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'internal-message-media',
  'internal-message-media',
  false,
  26214400,
  array[
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
