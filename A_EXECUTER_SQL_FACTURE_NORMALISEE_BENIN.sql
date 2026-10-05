-- ==============================================================================
-- A EXECUTER DANS L'EDITEUR SQL SUPABASE POUR LA FACTURE NORMALISEE BENIN (DGI)
-- ==============================================================================

begin;

alter table public.companies add column if not exists is_normalized_invoice_enabled boolean default false;
alter table public.companies add column if not exists dgi_nim varchar(60) default 'SF00000001';
alter table public.companies add column if not exists dgi_api_token text;
alter table public.companies add column if not exists dgi_env varchar(20) default 'sandbox';
alter table public.customers add column if not exists ifu varchar(60);

create index if not exists companies_normalized_invoice_idx on public.companies(id) where is_normalized_invoice_enabled = true;

commit;
