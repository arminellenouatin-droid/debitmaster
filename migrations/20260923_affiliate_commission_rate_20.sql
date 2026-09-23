-- DebitMaster: taux courant de commission affilié fixé à 20 %.
-- L'historique des commissions déjà calculées n'est pas réécrit.
update public.platform_affiliates set commission_rate = 20, updated_at = now() where status is not null;
