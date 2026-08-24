-- DebitManager: seuls les super-administrateurs peuvent modifier la configuration d’un affilié.
begin;
drop policy if exists platform_affiliates_self_update_or_master on public.platform_affiliates;
create policy platform_affiliates_master_update on public.platform_affiliates
  for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
commit;
