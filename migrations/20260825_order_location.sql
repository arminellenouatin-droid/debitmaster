-- Store the assigned service location on each order so the table can be resolved unambiguously.
alter table public.orders
  add column if not exists location_label text;

create index if not exists orders_tenant_location_created_idx
  on public.orders (tenant_id, location_label, created_at desc);

comment on column public.orders.location_label is
  'Service location/zone selected by the server when the order is created.';
