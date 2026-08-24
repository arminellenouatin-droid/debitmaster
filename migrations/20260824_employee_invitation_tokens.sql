-- DebitManager only: secure acceptance metadata for pending employee invitations.
alter table public.employee_invitations add column if not exists token_hash text;
alter table public.employee_invitations add column if not exists employee_id uuid references public.employees(id);
alter table public.employee_invitations add column if not exists accepted_user_id uuid references auth.users(id);
create unique index if not exists employee_invitations_token_hash_idx on public.employee_invitations(token_hash) where token_hash is not null;
create index if not exists employee_invitations_employee_idx on public.employee_invitations(employee_id);
