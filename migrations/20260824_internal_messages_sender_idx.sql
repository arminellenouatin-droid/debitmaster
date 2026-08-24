-- DebitManager: cover the sender foreign key for tenant-scoped internal message reads.
begin;
create index if not exists internal_messages_sender_idx on public.internal_messages(sender_user_id);
commit;
