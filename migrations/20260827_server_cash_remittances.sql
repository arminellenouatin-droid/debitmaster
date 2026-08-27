-- DebitManager Power: reversements individuels Serveuse -> Gérant.
-- Le Mobile Money est déclaré et contrôlé, mais seul le cash validé déplace la caisse.
create table if not exists public.server_cash_remittances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  server_user_id uuid not null references auth.users(id) on delete restrict,
  expected_cash_amount integer not null default 0 check (expected_cash_amount >= 0),
  declared_mobile_amount integer not null default 0 check (declared_mobile_amount >= 0),
  declared_cash_amount integer not null default 0 check (declared_cash_amount >= 0),
  received_cash_amount integer check (received_cash_amount is null or received_cash_amount >= 0),
  discrepancy_type text check (discrepancy_type is null or discrepancy_type in ('REMAINING_BALANCE','SHORTAGE')),
  discrepancy_amount integer not null default 0 check (discrepancy_amount >= 0),
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','ACCEPTED','REJECTED')),
  submitted_by uuid not null references auth.users(id),
  confirmed_by uuid references auth.users(id),
  note varchar(500),
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists server_cash_remittances_tenant_status_idx on public.server_cash_remittances (tenant_id, status, submitted_at desc);
create index if not exists server_cash_remittances_server_idx on public.server_cash_remittances (tenant_id, server_user_id, submitted_at desc);
alter table public.server_cash_remittances enable row level security;
drop policy if exists server_cash_remittances_select on public.server_cash_remittances;
create policy server_cash_remittances_select on public.server_cash_remittances for select to authenticated using (server_user_id = (select auth.uid()) or private.has_tenant_permission(tenant_id, 'finance.view'));
drop policy if exists server_cash_remittances_insert on public.server_cash_remittances;
create policy server_cash_remittances_insert on public.server_cash_remittances for insert to authenticated with check (server_user_id = (select auth.uid()) and submitted_by = (select auth.uid()) and private.has_tenant_permission(tenant_id, 'orders.create'));
drop policy if exists server_cash_remittances_update on public.server_cash_remittances;
create policy server_cash_remittances_update on public.server_cash_remittances for update to authenticated using (private.has_tenant_permission(tenant_id, 'finance.view')) with check (private.has_tenant_permission(tenant_id, 'finance.view'));

create table if not exists public.server_cash_register_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  remittance_id uuid not null references public.server_cash_remittances(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  register_type text not null check (register_type in ('SERVER_PERSONAL','GERANT_CENTRAL')),
  direction text not null check (direction in ('OUT','IN')),
  amount integer not null check (amount > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists server_cash_register_movements_remittance_register_idx on public.server_cash_register_movements (remittance_id, register_type);
create index if not exists server_cash_register_movements_tenant_idx on public.server_cash_register_movements (tenant_id, register_type, created_at desc);
alter table public.server_cash_register_movements enable row level security;
drop policy if exists server_cash_register_movements_select on public.server_cash_register_movements;
create policy server_cash_register_movements_select on public.server_cash_register_movements for select to authenticated using (private.has_tenant_permission(tenant_id, 'finance.view') or employee_id in (select e.id from public.employees e where e.user_id = (select auth.uid()) and e.tenant_id = tenant_id));

create or replace function public.confirm_server_cash_remittance(
  p_remittance_id uuid,
  p_received_cash_amount integer,
  p_discrepancy_type text default null,
  p_note text default null
) returns public.server_cash_remittances
language plpgsql security definer set search_path = public, private as $$
declare
  r public.server_cash_remittances;
  v_user uuid := (select auth.uid());
  v_difference integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.server_cash_remittances where id = p_remittance_id for update;
  if not found then raise exception 'REMITTANCE_NOT_FOUND'; end if;
  if not private.has_tenant_permission(r.tenant_id, 'finance.view') then raise exception 'FINANCE_PERMISSION_REQUIRED'; end if;
  if r.status <> 'SUBMITTED' then raise exception 'REMITTANCE_ALREADY_PROCESSED'; end if;
  if p_received_cash_amount is null or p_received_cash_amount < 0 then raise exception 'INVALID_RECEIVED_AMOUNT'; end if;
  v_difference := greatest(r.expected_cash_amount - p_received_cash_amount, 0);
  if v_difference > 0 and p_discrepancy_type not in ('REMAINING_BALANCE','SHORTAGE') then raise exception 'DISCREPANCY_TYPE_REQUIRED'; end if;
  update public.server_cash_remittances set received_cash_amount = p_received_cash_amount, discrepancy_amount = v_difference, discrepancy_type = case when v_difference = 0 then null else p_discrepancy_type end, status = 'ACCEPTED', confirmed_by = v_user, confirmed_at = now(), note = coalesce(p_note, note), updated_at = now() where id = r.id returning * into r;
  if p_received_cash_amount > 0 then
    insert into public.server_cash_register_movements (tenant_id, remittance_id, employee_id, register_type, direction, amount, created_by)
    values (r.tenant_id, r.id, r.employee_id, 'SERVER_PERSONAL', 'OUT', p_received_cash_amount, v_user), (r.tenant_id, r.id, r.employee_id, 'GERANT_CENTRAL', 'IN', p_received_cash_amount, v_user);
  end if;
  return r;
end; $$;
grant execute on function public.confirm_server_cash_remittance(uuid, integer, text, text) to authenticated;
