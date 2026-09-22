-- DebitMaster: activité Hôtel et auberge et informations légales du promoteur.
begin;

alter table public.companies add column if not exists city varchar(120);
alter table public.companies add column if not exists ifu_number varchar(80);
alter table public.companies add column if not exists trade_register varchar(120);
alter table public.companies add column if not exists promoter_photo_path text;
alter table public.companies add column if not exists identity_card_path text;

alter table public.companies drop constraint if exists companies_activity_type_check;
alter table public.companies add constraint companies_activity_type_check
  check (activity_type = any (array['BUVETTE','BAR','BAR_RESTAURANT','NIGHTCLUB_LOUNGE','HOTEL_AUBERGE','POWER']));

update public.companies set activity_type = 'HOTEL_AUBERGE' where activity_type = 'POWER' and deleted_at is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-documents', 'company-documents', false, 8388608, array['image/jpeg','image/png','image/webp','application/pdf']::text[])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

commit;

-- Les documents sont écrits par les routes serveur avec la clé privée et ne sont jamais publics.
