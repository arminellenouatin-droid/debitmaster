-- DebitManager: le propriétaire peut lire l’historique de l’abonnement de son propre établissement.
begin;

alter table public.saas_subscription_payments enable row level security;
drop policy if exists saas_subscription_payments_owner_select on public.saas_subscription_payments;
create policy saas_subscription_payments_owner_select on public.saas_subscription_payments
  for select to authenticated
  using (exists (
    select 1
    from public.companies c
    where c.id = saas_subscription_payments.tenant_id
      and c.owner_user_id = (select auth.uid())
      and c.deleted_at is null
  ));

commit;
