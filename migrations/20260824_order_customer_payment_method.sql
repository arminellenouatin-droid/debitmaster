-- DebitManager: rattachement client et mode de règlement des ventes.
alter table public.orders
  add column if not exists customer_id uuid references public.customers(id);
create index if not exists orders_tenant_customer_idx on public.orders (tenant_id, customer_id, created_at desc);

alter table public.payments
  add column if not exists payment_method text not null default 'CASH';
alter table public.payments
  drop constraint if exists payments_payment_method_check;
alter table public.payments
  add constraint payments_payment_method_check check (payment_method in ('CASH', 'MOBILE_MONEY'));
