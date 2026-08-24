-- DebitManager: explicit handoff between preparation staff and servers.
begin;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status = any (array['PENDING'::text, 'IN_PREPARATION'::text, 'READY'::text, 'HANDED_OFF'::text, 'DELIVERED'::text, 'PAID'::text, 'CANCELLED'::text]));

commit;
