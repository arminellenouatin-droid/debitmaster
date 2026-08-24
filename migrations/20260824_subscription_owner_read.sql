-- DebitManager: le propriétaire peut voir l'état de son abonnement, mais ne peut pas écrire un montant arbitraire.
begin;
create policy saas_subscription_payments_owner_select on public.saas_subscription_payments
  for select to authenticated
  using (exists (select 1 from public.companies c where c.id = saas_subscription_payments.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null));
commit;
