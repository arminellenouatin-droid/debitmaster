-- DebitManager: le plan Power devient un type d’établissement valide.
begin;
alter table public.companies drop constraint if exists companies_activity_type_check;
alter table public.companies add constraint companies_activity_type_check check (activity_type in ('BUVETTE', 'BAR', 'BAR_RESTAURANT', 'NIGHTCLUB_LOUNGE', 'POWER'));
commit;
