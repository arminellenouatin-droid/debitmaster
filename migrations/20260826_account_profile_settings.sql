-- DebitManager: profile settings for every authenticated account.
-- The avatar path is private and scoped to the authenticated user id.
alter table public.profiles
  add column if not exists avatar_path text;

comment on column public.profiles.avatar_path is 'Private Supabase Storage path for the profile avatar; never expose raw credentials.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy if not exists "profile avatars read own object"
on storage.objects for select
to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy if not exists "profile avatars insert own object"
on storage.objects for insert
to authenticated
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy if not exists "profile avatars update own object"
on storage.objects for update
to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

