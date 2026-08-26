-- DebitManager: MTN MoMo devient le fournisseur par défaut pour les nouveaux paiements.
-- Les historiques MONEROO restent valides et consultables.
begin;

alter table public.payments
  drop constraint if exists payments_provider_check;
alter table public.payments
  add constraint payments_provider_check check (provider in ('CASH', 'MONEROO', 'MTN_MOMO'));

alter table public.saas_subscription_payments
  drop constraint if exists saas_subscription_payments_provider_check;
alter table public.saas_subscription_payments
  add constraint saas_subscription_payments_provider_check check (provider in ('MONEROO', 'MTN_MOMO'));
alter table public.saas_subscription_payments
  alter column provider set default 'MTN_MOMO';

commit;
