begin;

alter table public.couture_models
  add column if not exists image_url text;

commit;
