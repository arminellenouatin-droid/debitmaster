-- DebitManager: nouveau taux d'affiliation à 15 %.
-- Les commissions déjà enregistrées gardent leur taux historique ; seules les futures commissions
-- utilisent le taux actualisé du profil affilié.
begin;

alter table public.platform_affiliates
  alter column commission_rate set default 15.00;

update public.platform_affiliates
set commission_rate = 15.00
where commission_rate = 10.00;

commit;
