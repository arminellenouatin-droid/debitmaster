-- DebitManager: l'affiliation est fixée au premier établissement et ne peut pas être détournée par un client.
begin;
create or replace function private.prevent_affiliate_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'UPDATE' and old.affiliate_id is distinct from new.affiliate_id and current_user <> 'service_role' then
    raise exception 'AFFILIATE_ATTRIBUTION_IMMUTABLE';
  end if;
  return new;
end;
$$;
drop trigger if exists companies_affiliate_immutable on public.companies;
create trigger companies_affiliate_immutable
before update of affiliate_id on public.companies
for each row execute function private.prevent_affiliate_reassignment();
commit;
