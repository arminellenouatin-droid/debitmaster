-- DebitMaster: catalogue commercial v2 — Bar, Restaurant, Hôtels, Prestige.
begin;

alter table public.saas_plan_prices add column if not exists billing_period text not null default 'MONTHLY';
alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_activity_plan_period_key;
alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_plan_code_check;
alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_billing_period_check;
alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_activity_code_plan_code_key;
delete from public.saas_plan_prices;
alter table public.saas_plan_prices add constraint saas_plan_prices_plan_code_check check (plan_code in ('BAR', 'RESTAURANT', 'HOTELS', 'PRESTIGE'));
alter table public.saas_plan_prices add constraint saas_plan_prices_billing_period_check check (billing_period in ('MONTHLY', 'ANNUAL'));
alter table public.saas_plan_prices add constraint saas_plan_prices_activity_plan_period_key unique (activity_code, plan_code, billing_period);

insert into public.saas_plan_prices (activity_code, plan_code, billing_period, price_xof, description)
select activities.activity_code, plans.plan_code, plans.billing_period, plans.price_xof, plans.description
from (values ('BAR'), ('BAR_RESTAURANT'), ('NIGHTCLUB_LOUNGE'), ('POWER')) as activities(activity_code)
cross join (values
  ('BAR', 'MONTHLY', 40000, 'Abonnement mensuel Bar — vente de boissons.'),
  ('BAR', 'ANNUAL', 360000, 'Abonnement annuel Bar — 25 % de réduction.'),
  ('RESTAURANT', 'MONTHLY', 60000, 'Abonnement mensuel Restaurant — boissons et repas.'),
  ('RESTAURANT', 'ANNUAL', 540000, 'Abonnement annuel Restaurant — 25 % de réduction.'),
  ('HOTELS', 'MONTHLY', 75000, 'Abonnement mensuel Hôtels — boissons, repas et chambres.'),
  ('HOTELS', 'ANNUAL', 675000, 'Abonnement annuel Hôtels — 25 % de réduction.'),
  ('PRESTIGE', 'MONTHLY', 100000, 'Abonnement mensuel Prestige — toutes les fonctionnalités.'),
  ('PRESTIGE', 'ANNUAL', 900000, 'Abonnement annuel Prestige — 25 % de réduction.')
) as plans(plan_code, billing_period, price_xof, description);

alter table public.saas_subscription_payments add column if not exists billing_period text not null default 'MONTHLY';
alter table public.saas_subscription_payments drop constraint if exists saas_subscription_payments_billing_period_check;
alter table public.saas_subscription_payments add constraint saas_subscription_payments_billing_period_check check (billing_period in ('MONTHLY', 'ANNUAL'));

alter table public.companies alter column trial_ends_at set default (now() + interval '30 days');
update public.companies
set trial_ends_at = coalesce(trial_ends_at, coalesce(created_at, now()) + interval '30 days')
where status = 'TRIAL' and deleted_at is null;
update public.companies
set subscription_plan = 'PRESTIGE'
where upper(trim(name)) = 'BAR SANTE PLUS' and deleted_at is null;

commit;
