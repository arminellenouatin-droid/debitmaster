-- DebitManager: independent work zones per tenant, with table and staff-zone links.
-- Non-destructive: existing dining_tables.zone values are converted into work_zones and zone_id.
begin;

create table if not exists public.work_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  name varchar(80) not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table public.dining_tables
  add column if not exists zone_id uuid references public.work_zones(id) on delete set null;

insert into public.work_zones (tenant_id, name)
select distinct dt.tenant_id, btrim(dt.zone)
from public.dining_tables dt
where dt.deleted_at is null
  and dt.zone is not null
  and btrim(dt.zone) <> ''
  and not exists (
    select 1 from public.work_zones wz
    where wz.tenant_id = dt.tenant_id
      and wz.name = btrim(dt.zone)
  );

update public.dining_tables dt
set zone_id = wz.id
from public.work_zones wz
where dt.tenant_id = wz.tenant_id
  and dt.zone_id is null
  and dt.zone is not null
  and btrim(dt.zone) = wz.name;

create table if not exists public.employee_zone_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  zone_id uuid not null references public.work_zones(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, employee_id, zone_id)
);

insert into public.employee_zone_assignments (tenant_id, employee_id, zone_id)
select distinct eta.tenant_id, eta.employee_id, dt.zone_id
from public.employee_table_assignments eta
join public.dining_tables dt on dt.id = eta.table_id and dt.tenant_id = eta.tenant_id
where dt.zone_id is not null
  and not exists (
    select 1 from public.employee_zone_assignments eza
    where eza.tenant_id = eta.tenant_id
      and eza.employee_id = eta.employee_id
      and eza.zone_id = dt.zone_id
  );

create index if not exists work_zones_tenant_active_idx on public.work_zones(tenant_id, is_active, name);
create index if not exists dining_tables_tenant_zone_idx on public.dining_tables(tenant_id, zone_id) where deleted_at is null;
create index if not exists employee_zone_assignments_tenant_employee_idx on public.employee_zone_assignments(tenant_id, employee_id);

alter table public.work_zones enable row level security;
alter table public.employee_zone_assignments enable row level security;

drop policy if exists work_zones_select on public.work_zones;
create policy work_zones_select on public.work_zones
  for select to authenticated
  using (
    is_active
    and (
      tenant_id = private.current_tenant_id()
      or exists (select 1 from public.companies c where c.id = work_zones.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)
    )
  );

drop policy if exists work_zones_insert on public.work_zones;
create policy work_zones_insert on public.work_zones
  for insert to authenticated
  with check (
    tenant_id = private.current_tenant_id()
    or exists (select 1 from public.companies c where c.id = work_zones.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)
  );

drop policy if exists work_zones_update on public.work_zones;
create policy work_zones_update on public.work_zones
  for update to authenticated
  using (
    tenant_id = private.current_tenant_id()
    or exists (select 1 from public.companies c where c.id = work_zones.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)
  )
  with check (
    tenant_id = private.current_tenant_id()
    or exists (select 1 from public.companies c where c.id = work_zones.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)
  );

drop policy if exists employee_zone_assignments_select on public.employee_zone_assignments;
create policy employee_zone_assignments_select on public.employee_zone_assignments
  for select to authenticated
  using (
    tenant_id = private.current_tenant_id()
    or exists (select 1 from public.companies c where c.id = employee_zone_assignments.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)
  );

drop policy if exists employee_zone_assignments_insert on public.employee_zone_assignments;
create policy employee_zone_assignments_insert on public.employee_zone_assignments
  for insert to authenticated
  with check (
    tenant_id = private.current_tenant_id()
    or exists (select 1 from public.companies c where c.id = employee_zone_assignments.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)
  );

drop policy if exists employee_zone_assignments_delete on public.employee_zone_assignments;
create policy employee_zone_assignments_delete on public.employee_zone_assignments
  for delete to authenticated
  using (
    tenant_id = private.current_tenant_id()
    or exists (select 1 from public.companies c where c.id = employee_zone_assignments.tenant_id and c.owner_user_id = (select auth.uid()) and c.deleted_at is null)
  );

comment on table public.work_zones is 'Independent service/work zones configured per establishment.';
comment on column public.dining_tables.zone_id is 'Canonical work zone reference; legacy zone text remains for compatibility.';
comment on table public.employee_zone_assignments is 'Explicit staff assignments to permitted work zones.';

commit;
