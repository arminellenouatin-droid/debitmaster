-- DebitManager: une attribution d’établissement ne peut référencer qu’un affilié existant.
begin;
alter table public.companies
  drop constraint if exists companies_affiliate_id_fkey;
alter table public.companies
  add constraint companies_affiliate_id_fkey foreign key (affiliate_id) references public.platform_affiliates(id) on delete set null;
commit;
