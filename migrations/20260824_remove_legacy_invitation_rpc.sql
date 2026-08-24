-- DebitManager: remove the legacy one-argument invitation RPC.
-- The server-only three-argument RPC is the only supported invitation path.
begin;

drop function if exists public.accept_employee_invitation(text);

commit;
