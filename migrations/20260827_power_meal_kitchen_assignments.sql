-- DebitManager Power: répartition d'une ligne de repas entre plusieurs cuisiniers.
begin;

create table if not exists public.kitchen_order_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  cook_employee_id uuid not null references public.employees(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'ASSIGNED' check (status in ('ASSIGNED','IN_PREPARATION','READY','HANDED_OFF','CANCELLED')),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  prepared_at timestamptz,
  handed_off_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kitchen_assignments_tenant_order_idx
  on public.kitchen_order_assignments(tenant_id, order_id, created_at);
create index if not exists kitchen_assignments_cook_status_idx
  on public.kitchen_order_assignments(tenant_id, cook_employee_id, status, created_at desc);

alter table public.kitchen_order_assignments enable row level security;

drop policy if exists kitchen_assignments_select_authorized on public.kitchen_order_assignments;
create policy kitchen_assignments_select_authorized on public.kitchen_order_assignments
  for select to authenticated
  using (
    private.has_tenant_permission(tenant_id, 'orders.view')
    and (
      private.has_tenant_permission(tenant_id, 'orders.prepare')
      or cook_employee_id in (select e.id from public.employees e where e.user_id = (select auth.uid()) and e.tenant_id = kitchen_order_assignments.tenant_id and e.status = 'ACTIVE' and e.deleted_at is null)
    )
  );

drop policy if exists kitchen_assignments_insert_authorized on public.kitchen_order_assignments;
create policy kitchen_assignments_insert_authorized on public.kitchen_order_assignments
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'orders.prepare'));

drop policy if exists kitchen_assignments_update_authorized on public.kitchen_order_assignments;
create policy kitchen_assignments_update_authorized on public.kitchen_order_assignments
  for update to authenticated
  using (
    private.has_tenant_permission(tenant_id, 'orders.prepare')
    or cook_employee_id in (select e.id from public.employees e where e.user_id = (select auth.uid()) and e.tenant_id = kitchen_order_assignments.tenant_id and e.status = 'ACTIVE' and e.deleted_at is null)
  )
  with check (
    private.has_tenant_permission(tenant_id, 'orders.prepare')
    or cook_employee_id in (select e.id from public.employees e where e.user_id = (select auth.uid()) and e.tenant_id = kitchen_order_assignments.tenant_id and e.status = 'ACTIVE' and e.deleted_at is null)
  );

create or replace function public.kitchen_assignments_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists kitchen_assignments_touch_updated_at on public.kitchen_order_assignments;
create trigger kitchen_assignments_touch_updated_at before update on public.kitchen_order_assignments
for each row execute function public.kitchen_assignments_touch_updated_at();

commit;
