-- DebitManager only: employee invitations and tenant-scoped permission overrides.
create table if not exists public.employee_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  email varchar(320) not null,
  first_name varchar(120) not null,
  last_name varchar(120) not null,
  position varchar(80) not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  employee_id uuid not null references public.employees(id),
  permission_key varchar(100) not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, permission_key)
);

create index if not exists employee_invitations_tenant_idx on public.employee_invitations(tenant_id, status, created_at desc);
create index if not exists employee_permissions_tenant_idx on public.employee_permissions(tenant_id, employee_id);

alter table public.employee_invitations enable row level security;
alter table public.employee_permissions enable row level security;

drop policy if exists employee_invitations_owner_all on public.employee_invitations;
create policy employee_invitations_owner_all on public.employee_invitations
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = auth.uid()))
  with check (tenant_id in (select id from public.companies where owner_user_id = auth.uid()));

drop policy if exists employee_permissions_owner_all on public.employee_permissions;
create policy employee_permissions_owner_all on public.employee_permissions
  for all to authenticated
  using (tenant_id in (select id from public.companies where owner_user_id = auth.uid()))
  with check (
    tenant_id in (select id from public.companies where owner_user_id = auth.uid())
    and exists (select 1 from public.employees e where e.id = employee_id and e.tenant_id = tenant_id)
  );

revoke all on public.employee_invitations from anon;
revoke all on public.employee_permissions from anon;
