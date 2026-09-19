-- DebitManager: preserve the server-selected side dish on meal order lines.
alter table public.order_items
  add column if not exists accompaniment text not null default 'Aucun';

alter table public.order_items
  drop constraint if exists order_items_accompaniment_check;

alter table public.order_items
  add constraint order_items_accompaniment_check
  check (accompaniment in ('Aucun', 'Riz', 'Pâte', 'Frites', 'Attiéké', 'Salade composée', 'Alloco'));
