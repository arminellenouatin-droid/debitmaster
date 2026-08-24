-- DebitManager magasinier: sorties bornées par destination et demandes d’approvisionnement tenant-scoped.
begin;

alter table public.stock_movements
  add column if not exists destination text;

alter table public.stock_movements
  drop constraint if exists stock_movements_destination_check;
alter table public.stock_movements
  add constraint stock_movements_destination_check
  check (destination is null or destination in ('BAR', 'CUISINE'));

create index if not exists stock_movements_tenant_destination_idx
  on public.stock_movements (tenant_id, destination, created_at desc);

create table if not exists public.supply_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  requested_by uuid not null references auth.users(id),
  quantity integer not null check (quantity > 0),
  destination text check (destination is null or destination in ('BAR', 'CUISINE')),
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED')),
  notes varchar(240),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supply_requests_tenant_status_idx
  on public.supply_requests (tenant_id, status, created_at desc);

alter table public.supply_requests enable row level security;

drop policy if exists supply_requests_select_authorized on public.supply_requests;
create policy supply_requests_select_authorized on public.supply_requests
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.view'));

drop policy if exists supply_requests_insert_authorized on public.supply_requests;
create policy supply_requests_insert_authorized on public.supply_requests
  for insert to authenticated
  with check (
    private.has_tenant_permission(tenant_id, 'stock.receive')
    and requested_by = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.tenant_id = tenant_id and p.deleted_at is null)
  );

drop policy if exists supply_requests_update_authorized on public.supply_requests;
create policy supply_requests_update_authorized on public.supply_requests
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.receive'))
  with check (private.has_tenant_permission(tenant_id, 'stock.receive'));

revoke all on public.supply_requests from anon;

commit;
