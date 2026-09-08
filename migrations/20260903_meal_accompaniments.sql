begin;

alter table public.order_items
  add column if not exists offered_accompaniment_product_id uuid references public.products(id) on delete set null,
  add column if not exists offered_accompaniment_quantity integer not null default 0,
  add column if not exists purchased_accompaniment_product_id uuid references public.products(id) on delete set null,
  add column if not exists purchased_accompaniment_quantity integer not null default 0,
  add column if not exists purchased_accompaniment_unit_price integer not null default 0;

alter table public.order_items
  drop constraint if exists order_items_accompaniment_quantity_check;

alter table public.order_items
  add constraint order_items_accompaniment_quantity_check
  check (
    offered_accompaniment_quantity >= 0
    and purchased_accompaniment_quantity >= 0
    and purchased_accompaniment_unit_price >= 0
  );

create index if not exists order_items_offered_accompaniment_idx
  on public.order_items (offered_accompaniment_product_id)
  where offered_accompaniment_product_id is not null;

create index if not exists order_items_purchased_accompaniment_idx
  on public.order_items (purchased_accompaniment_product_id)
  where purchased_accompaniment_product_id is not null;

commit;
