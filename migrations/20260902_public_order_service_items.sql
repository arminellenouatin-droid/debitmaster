-- DebitManager Power QR: service requests share the public order parent without entering a paid sale before operator confirmation.
create table if not exists public.order_service_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  activity_code text not null check (activity_code in ('GYM','LAVAGE','LODGING','WIFI')),
  service_id uuid references public.company_services(id) on delete set null,
  room_id uuid references public.power_lodging_rooms(id) on delete set null,
  label varchar(160) not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_xof integer not null check (unit_price_xof >= 0),
  total_amount_xof integer generated always as (quantity * unit_price_xof) stored,
  customer_name varchar(160),
  note varchar(500),
  status text not null default 'REQUESTED' check (status in ('REQUESTED','ACCEPTED','IN_PROGRESS','READY','COMPLETED','CANCELLED')),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','PAID','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_service_items_tenant_activity_idx on public.order_service_items (tenant_id, activity_code, status, created_at desc);
create index if not exists order_service_items_order_idx on public.order_service_items (order_id, created_at);
alter table public.order_service_items enable row level security;
drop policy if exists order_service_items_select on public.order_service_items;
create policy order_service_items_select on public.order_service_items for select to authenticated using (private.has_tenant_permission(tenant_id, 'services.view') or private.has_tenant_permission(tenant_id, 'orders.view'));
