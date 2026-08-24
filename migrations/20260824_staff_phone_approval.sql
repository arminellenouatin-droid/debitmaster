-- DebitManager: phone-first staff access with owner approval for establishment-code signups.
begin;

alter table public.profiles
  add column if not exists phone varchar(32);

alter table public.employees
  add column if not exists phone varchar(32),
  add column if not exists must_change_password boolean not null default true,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists created_by uuid references auth.users(id);

create unique index if not exists employees_tenant_phone_active_idx
  on public.employees (tenant_id, phone)
  where phone is not null and deleted_at is null and status <> 'REJECTED';

create table if not exists public.employee_access_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  phone varchar(32) not null,
  first_name varchar(120) not null,
  last_name varchar(120) not null,
  position varchar(80) not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (tenant_id, user_id)
);

create unique index if not exists employee_access_requests_pending_phone_idx
  on public.employee_access_requests (tenant_id, phone)
  where status = 'PENDING';

create index if not exists employee_access_requests_tenant_status_idx
  on public.employee_access_requests (tenant_id, status, requested_at desc);

alter table public.employee_access_requests enable row level security;

revoke all on public.employee_access_requests from anon;
revoke all on public.employee_access_requests from authenticated;
grant select on public.employee_access_requests to authenticated;

drop policy if exists employee_access_requests_select_owner_or_requester on public.employee_access_requests;
create policy employee_access_requests_select_owner_or_requester on public.employee_access_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.companies c
      where c.id = employee_access_requests.tenant_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

commit;
