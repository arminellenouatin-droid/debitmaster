-- DebitManager: allow an authenticated company owner to manage catalog rows
-- before a profile tenant_id has been assigned, while preserving tenant isolation.

begin;

drop policy if exists categories_authenticated_access on public.categories;
create policy categories_authenticated_access on public.categories
  for all to authenticated
  using (
    tenant_id = private.current_tenant_id()
    or exists (
      select 1
      from public.companies c
      where c.id = categories.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  )
  with check (
    tenant_id = private.current_tenant_id()
    or exists (
      select 1
      from public.companies c
      where c.id = categories.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

drop policy if exists products_authenticated_access on public.products;
create policy products_authenticated_access on public.products
  for all to authenticated
  using (
    tenant_id = private.current_tenant_id()
    or exists (
      select 1
      from public.companies c
      where c.id = products.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  )
  with check (
    tenant_id = private.current_tenant_id()
    or exists (
      select 1
      from public.companies c
      where c.id = products.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

commit;
