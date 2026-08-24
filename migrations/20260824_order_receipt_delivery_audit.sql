-- DebitManager: preuve métier de remise au serveur et de livraison au client.
alter table public.orders
  add column if not exists received_by_user_id uuid references auth.users(id),
  add column if not exists received_at timestamptz,
  add column if not exists delivered_by_user_id uuid references auth.users(id),
  add column if not exists delivered_at timestamptz;
create index if not exists orders_receipt_delivery_audit_idx on public.orders (tenant_id, received_by_user_id, delivered_by_user_id, created_at desc);
