-- Photos publiques facultatives des prestations Power, sans données imposées.
alter table public.company_services add column if not exists image_url text;
