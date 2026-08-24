-- DebitManager: état d’accès initial pour les profils plateforme.
begin;
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;
commit;
