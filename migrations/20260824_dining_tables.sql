-- DebitManager: persistent floor-plan tables, isolated per tenant.
begin;

create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  label varchar(80) not null,
  zone varchar(80),
  capacity integer not null default 2 check (capacity between 1 and 100),
  status text not null default 'FREE' check (status in ('FREE', 'OCCUPIED', 'RESERVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, label)
);

create index if not exists dining_tables_tenant_status_idx on public.dining_tables(tenant_id, status) where deleted_at is null;

alter table public.dining_tables enable row level security;

drop policy if exists dining_tables_select on public.dining_tables;
create policy dining_tables_select on public.dining_tables
  for select to authenticated
  using (
    deleted_at is null
    and (
      tenant_id = private.current_tenant_id()
      or exists (
        select 1 from public.companies c
        where c.id = dining_tables.tenant_id
          and c.owner_user_id = (select auth.uid())
          and c.deleted_at is null
      )
    )
  );

drop policy if exists dining_tables_insert on public.dining_tables;
create policy dining_tables_insert on public.dining_tables
  for insert to authenticated
  with check (
    (
      tenant_id = private.current_tenant_id()
      or exists (
        select 1 from public.companies c
        where c.id = dining_tables.tenant_id
          and c.owner_user_id = (select auth.uid())
          and c.deleted_at is null
      )
    )
    and deleted_at is null
  );

drop policy if exists dining_tables_update on public.dining_tables;
create policy dining_tables_update on public.dining_tables
  for update to authenticated
  using (
    tenant_id = private.current_tenant_id()
    or exists (
      select 1 from public.companies c
      where c.id = dining_tables.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  )
  with check (
    tenant_id = private.current_tenant_id()
    or exists (
      select 1 from public.companies c
      where c.id = dining_tables.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

commit;
