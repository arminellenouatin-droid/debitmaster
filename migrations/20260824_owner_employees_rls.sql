-- DebitManager: allow an authenticated company owner to manage employees
-- before profile tenant_id is assigned, while preserving tenant isolation.

begin;

drop policy if exists employees_authenticated_access on public.employees;
create policy employees_authenticated_access on public.employees
  for all to authenticated
  using (
    tenant_id = private.current_tenant_id()
    or exists (
      select 1
      from public.companies c
      where c.id = employees.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  )
  with check (
    tenant_id = private.current_tenant_id()
    or exists (
      select 1
      from public.companies c
      where c.id = employees.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

commit;
