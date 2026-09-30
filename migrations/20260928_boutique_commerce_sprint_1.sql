-- DebitMaster: Sprint 1 for the independent retail purchase-and-sale activity.
-- Existing activities, their role tables and their workflows remain unchanged.
begin;

alter table public.companies drop constraint if exists companies_activity_type_check;
alter table public.companies add constraint companies_activity_type_check
  check (activity_type = any (array['BUVETTE','BAR_RESTAURANT','NIGHTCLUB_LOUNGE','HOTEL_AUBERGE','BOUTIQUE_COMMERCE']));

alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_activity_code_check;
alter table public.saas_plan_prices add constraint saas_plan_prices_activity_code_check
  check (activity_code = any (array['BUVETTE','BAR_RESTAURANT','NIGHTCLUB_LOUNGE','HOTEL_AUBERGE','BOUTIQUE_COMMERCE']));
alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_plan_code_check;
alter table public.saas_plan_prices add constraint saas_plan_prices_plan_code_check
  check (plan_code = any (array['BUVETTE','BAR_RESTAURANT','HOTEL_AUBERGE','BOUTIQUE_COMMERCE']));

-- Seed only the new activity; preserve every existing/admin-configured price.
insert into public.saas_plan_prices (activity_code, plan_code, billing_period, price_xof, description, is_active)
values
  ('BOUTIQUE_COMMERCE','BOUTIQUE_COMMERCE','MONTHLY',50000,'Commerce achat-vente en magasin',true),
  ('BOUTIQUE_COMMERCE','BOUTIQUE_COMMERCE','ANNUAL',450000,'Commerce achat-vente en magasin — annuel',true)
on conflict (activity_code, plan_code, billing_period) do nothing;

create table if not exists public.commerce_stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  store_type text not null default 'RETAIL' check (store_type in ('RETAIL','WAREHOUSE','POINT_OF_SALE')),
  address text,
  city text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists commerce_stores_name_per_tenant_idx
  on public.commerce_stores (tenant_id, lower(name));

create table if not exists public.commerce_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  role_key text not null check (role_key ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, role_key),
  unique (id, tenant_id)
);

create table if not exists public.commerce_role_permissions (
  tenant_id uuid not null,
  role_id uuid not null,
  permission_key text not null check (permission_key = any (array[
    'dashboard.view','stores.view','stores.manage','team.view','team.manage','audit.view',
    'catalog.view','catalog.manage','customers.view','customers.manage','suppliers.view','suppliers.manage',
    'sales.view','sales.create','sales.approve','cash.view','cash.manage','cash.close',
    'stock.view','stock.manage','stock.receive','stock.issue','stock.transfer',
    'inventory.view','inventory.count','inventory.validate','procurement.view','procurement.manage','procurement.approve',
    'accounting.view','treasury.view','reports.view','reports.export','hr.view','hr.manage',
    'attendance.view','attendance.manage','costs.view'
  ])),
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key),
  foreign key (role_id, tenant_id) references public.commerce_roles(id, tenant_id) on delete cascade
);

create table if not exists public.commerce_employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  phone text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  must_change_password boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (id, tenant_id)
);
create index if not exists commerce_employees_user_tenant_idx
  on public.commerce_employees (user_id, tenant_id) where status = 'ACTIVE';

create table if not exists public.commerce_employee_roles (
  tenant_id uuid not null,
  employee_id uuid not null,
  role_id uuid not null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (employee_id, role_id),
  foreign key (employee_id, tenant_id) references public.commerce_employees(id, tenant_id) on delete cascade,
  foreign key (role_id, tenant_id) references public.commerce_roles(id, tenant_id) on delete restrict
);

create table if not exists public.commerce_employee_stores (
  tenant_id uuid not null,
  employee_id uuid not null,
  store_id uuid not null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (employee_id, store_id),
  foreign key (employee_id, tenant_id) references public.commerce_employees(id, tenant_id) on delete cascade,
  foreign key (store_id, tenant_id) references public.commerce_stores(id, tenant_id) on delete cascade
);

create table if not exists public.commerce_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists commerce_audit_events_tenant_created_idx
  on public.commerce_audit_events (tenant_id, created_at desc);
create index if not exists commerce_audit_events_actor_created_idx
  on public.commerce_audit_events (actor_user_id, created_at desc);

create or replace function private.commerce_subscription_mode(p_tenant_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_cutoff timestamptz;
begin
  select upper(coalesce(c.status, '')), coalesce(c.subscription_expires_at, c.trial_ends_at)
    into v_status, v_cutoff
  from public.companies c
  where c.id = p_tenant_id and c.activity_type = 'BOUTIQUE_COMMERCE' and c.deleted_at is null;
  if not found or v_status in ('SUSPENDED','CANCELLED') then return 'BLOCKED'; end if;
  if v_status = 'EXPIRED' then return 'READ_ONLY'; end if;
  if v_cutoff is null then
    if v_status in ('TRIAL','ACTIVE','PAID') then return 'ACTIVE'; end if;
    return 'READ_ONLY';
  end if;
  if v_cutoff > now() then return 'ACTIVE'; end if;
  if now() <= v_cutoff + interval '5 days' then return 'GRACE'; end if;
  return 'READ_ONLY';
end;
$$;

create or replace function private.commerce_is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.commerce_subscription_mode(p_tenant_id) <> 'BLOCKED'
    and (
      exists (select 1 from public.companies c where c.id = p_tenant_id and c.owner_user_id = (select auth.uid()) and c.activity_type = 'BOUTIQUE_COMMERCE' and c.deleted_at is null)
      or exists (select 1 from public.commerce_employees e where e.tenant_id = p_tenant_id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE' and e.must_change_password = false)
    );
$$;

create or replace function private.commerce_is_owner(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_tenant_id and c.owner_user_id = (select auth.uid())
      and c.activity_type = 'BOUTIQUE_COMMERCE' and c.deleted_at is null
  );
$$;

create or replace function private.commerce_has_permission(p_tenant_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.commerce_is_tenant_member(p_tenant_id)
    and (
      private.commerce_is_owner(p_tenant_id)
      or exists (
        select 1
        from public.commerce_employees e
        join public.commerce_employee_roles er on er.employee_id = e.id and er.tenant_id = e.tenant_id
        join public.commerce_role_permissions rp on rp.role_id = er.role_id and rp.tenant_id = er.tenant_id
        where e.tenant_id = p_tenant_id and e.user_id = (select auth.uid())
          and e.status = 'ACTIVE' and rp.permission_key = p_permission_key
      )
    );
$$;

create or replace function private.commerce_user_can_access_store(p_tenant_id uuid, p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.commerce_is_owner(p_tenant_id)
    or exists (
      select 1 from public.commerce_employee_stores es
      join public.commerce_employees e on e.id = es.employee_id and e.tenant_id = es.tenant_id
      where es.tenant_id = p_tenant_id and es.store_id = p_store_id
        and e.user_id = (select auth.uid()) and e.status = 'ACTIVE' and e.must_change_password = false
    );
$$;

create or replace function private.commerce_can_write(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.commerce_is_tenant_member(p_tenant_id)
    and private.commerce_subscription_mode(p_tenant_id) = 'ACTIVE';
$$;

create or replace function private.provision_commerce_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role record;
  v_role_id uuid;
  v_permission text;
begin
  if new.activity_type <> 'BOUTIQUE_COMMERCE' then return new; end if;

  insert into public.commerce_stores (tenant_id, name, store_type, created_by)
  values (new.id, 'Magasin principal', 'RETAIL', new.owner_user_id)
  on conflict do nothing;

  for v_role in
    select * from (values
      ('GERANT','Gérant','Gestion opérationnelle',array['dashboard.view','stores.view','stores.manage','team.view','team.manage','audit.view','catalog.view','catalog.manage','customers.view','customers.manage','suppliers.view','suppliers.manage','sales.view','sales.create','sales.approve','cash.view','cash.manage','cash.close','stock.view','stock.manage','stock.receive','stock.issue','stock.transfer','inventory.view','inventory.count','inventory.validate','procurement.view','procurement.manage','procurement.approve','accounting.view','treasury.view','reports.view','reports.export','hr.view','hr.manage','attendance.view','attendance.manage','costs.view']::text[]),
      ('VENDEUR','Vendeur / Commercial','Vente et relation client',array['dashboard.view','stores.view','catalog.view','customers.view','customers.manage','sales.view','sales.create','reports.view']::text[]),
      ('CAISSIER','Caissier','Encaissements et clôture de caisse',array['dashboard.view','stores.view','sales.view','cash.view','cash.manage','cash.close','reports.view']::text[]),
      ('MAGASINIER','Magasinier','Préparation, réception et mouvements de stock',array['dashboard.view','stores.view','catalog.view','stock.view','stock.receive','stock.issue','stock.transfer']::text[]),
      ('APPROVISIONNEMENT','Chargé des approvisionnements','Fournisseurs et achats',array['dashboard.view','stores.view','catalog.view','suppliers.view','suppliers.manage','procurement.view','procurement.manage','stock.view','stock.receive']::text[]),
      ('INVENTAIRE','Responsable d’inventaire','Comptages et écarts de stock',array['dashboard.view','stores.view','catalog.view','stock.view','inventory.view','inventory.count','reports.view']::text[]),
      ('COMPTABLE','Comptable','Comptabilité et trésorerie',array['dashboard.view','sales.view','cash.view','accounting.view','treasury.view','reports.view','reports.export','costs.view']::text[]),
      ('RH','Responsable RH / Personnel','Gestion du personnel',array['dashboard.view','team.view','hr.view','hr.manage','attendance.view','attendance.manage']::text[])
    ) as defaults(role_key, role_name, role_description, permission_keys)
  loop
    insert into public.commerce_roles (tenant_id, role_key, name, description, is_system)
    values (new.id, v_role.role_key, v_role.role_name, v_role.role_description, true)
    on conflict (tenant_id, role_key) do update set name = excluded.name, description = excluded.description
    returning id into v_role_id;
    foreach v_permission in array v_role.permission_keys loop
      insert into public.commerce_role_permissions (tenant_id, role_id, permission_key)
      values (new.id, v_role_id, v_permission)
      on conflict (role_id, permission_key) do nothing;
    end loop;
  end loop;
  insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (new.id, new.owner_user_id, 'ESTABLISHMENT_CREATED', 'COMPANY', new.id::text, jsonb_build_object('activity_type', new.activity_type));
  return new;
end;
$$;

drop trigger if exists companies_provision_commerce_tenant on public.companies;
create trigger companies_provision_commerce_tenant
after insert on public.companies
for each row execute function private.provision_commerce_tenant();

create or replace function private.prevent_commerce_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'COMMERCE_AUDIT_EVENTS_IMMUTABLE';
end;
$$;
drop trigger if exists commerce_audit_events_immutable on public.commerce_audit_events;
create trigger commerce_audit_events_immutable
before update or delete on public.commerce_audit_events
for each row execute function private.prevent_commerce_audit_mutation();

create or replace function private.audit_commerce_subscription_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
  v_action text;
begin
  if not exists (select 1 from public.companies c where c.id = new.tenant_id and c.activity_type = 'BOUTIQUE_COMMERCE') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    v_action := 'SUBSCRIPTION_PAYMENT_REQUESTED';
  else
    v_action := case upper(coalesce(new.status, ''))
      when 'SUCCEEDED' then 'SUBSCRIPTION_PAYMENT_SUCCEEDED'
      when 'FAILED' then 'SUBSCRIPTION_PAYMENT_FAILED'
      when 'REFUNDED' then 'SUBSCRIPTION_PAYMENT_REFUNDED'
      else 'SUBSCRIPTION_PAYMENT_STATUS_CHANGED'
    end;
  end if;
  begin
    v_actor_user_id := nullif(new.metadata ->> 'requested_by_user_id', '')::uuid;
  exception when invalid_text_representation then
    v_actor_user_id := null;
  end;
  insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (new.tenant_id, v_actor_user_id, v_action, 'SUBSCRIPTION_PAYMENT', new.id::text,
    jsonb_build_object('plan', new.plan, 'billing_period', new.billing_period, 'amount', new.amount, 'currency', new.currency, 'status', new.status));
  return new;
end;
$$;
drop trigger if exists commerce_subscription_payment_audit_insert on public.saas_subscription_payments;
create trigger commerce_subscription_payment_audit_insert after insert on public.saas_subscription_payments
for each row execute function private.audit_commerce_subscription_payment();
drop trigger if exists commerce_subscription_payment_audit_status on public.saas_subscription_payments;
create trigger commerce_subscription_payment_audit_status after update of status on public.saas_subscription_payments
for each row when (old.status is distinct from new.status) execute function private.audit_commerce_subscription_payment();

alter table public.commerce_stores enable row level security;
alter table public.commerce_roles enable row level security;
alter table public.commerce_role_permissions enable row level security;
alter table public.commerce_employees enable row level security;
alter table public.commerce_employee_roles enable row level security;
alter table public.commerce_employee_stores enable row level security;
alter table public.commerce_audit_events enable row level security;

revoke all on public.commerce_stores, public.commerce_roles, public.commerce_role_permissions,
  public.commerce_employees, public.commerce_employee_roles, public.commerce_employee_stores, public.commerce_audit_events from anon, authenticated;
grant select on public.commerce_stores, public.commerce_roles, public.commerce_role_permissions,
  public.commerce_employees, public.commerce_employee_roles, public.commerce_employee_stores, public.commerce_audit_events to authenticated;
grant select, insert, update, delete on public.commerce_stores, public.commerce_roles, public.commerce_role_permissions,
  public.commerce_employees, public.commerce_employee_roles, public.commerce_employee_stores to service_role;
grant select, insert on public.commerce_audit_events to service_role;

-- Authenticated clients receive only scoped reads; all writes flow through checked server APIs.
drop policy if exists commerce_stores_select on public.commerce_stores;
create policy commerce_stores_select on public.commerce_stores for select to authenticated
  using (private.commerce_has_permission(tenant_id,'stores.view') and private.commerce_user_can_access_store(tenant_id,id));
drop policy if exists commerce_stores_insert on public.commerce_stores;
create policy commerce_stores_insert on public.commerce_stores for insert to authenticated
  with check (private.commerce_can_write(tenant_id) and private.commerce_has_permission(tenant_id,'stores.manage'));
drop policy if exists commerce_stores_update on public.commerce_stores;
create policy commerce_stores_update on public.commerce_stores for update to authenticated
  using (private.commerce_can_write(tenant_id) and private.commerce_has_permission(tenant_id,'stores.manage') and private.commerce_user_can_access_store(tenant_id,id))
  with check (private.commerce_can_write(tenant_id) and private.commerce_has_permission(tenant_id,'stores.manage'));
drop policy if exists commerce_stores_delete on public.commerce_stores;
create policy commerce_stores_delete on public.commerce_stores for delete to authenticated
  using (private.commerce_can_write(tenant_id) and private.commerce_is_owner(tenant_id));

drop policy if exists commerce_roles_select on public.commerce_roles;
create policy commerce_roles_select on public.commerce_roles for select to authenticated
  using (private.commerce_has_permission(tenant_id,'team.view'));
drop policy if exists commerce_roles_insert on public.commerce_roles;
create policy commerce_roles_insert on public.commerce_roles for insert to authenticated
  with check (private.commerce_can_write(tenant_id) and private.commerce_is_owner(tenant_id) and not is_system);
drop policy if exists commerce_roles_update on public.commerce_roles;
create policy commerce_roles_update on public.commerce_roles for update to authenticated
  using (private.commerce_can_write(tenant_id) and private.commerce_is_owner(tenant_id) and not is_system)
  with check (private.commerce_can_write(tenant_id) and private.commerce_is_owner(tenant_id) and not is_system);
drop policy if exists commerce_roles_delete on public.commerce_roles;
create policy commerce_roles_delete on public.commerce_roles for delete to authenticated
  using (private.commerce_can_write(tenant_id) and private.commerce_is_owner(tenant_id) and not is_system);

drop policy if exists commerce_role_permissions_select on public.commerce_role_permissions;
create policy commerce_role_permissions_select on public.commerce_role_permissions for select to authenticated
  using (private.commerce_has_permission(tenant_id,'team.view'));
drop policy if exists commerce_role_permissions_write on public.commerce_role_permissions;
create policy commerce_role_permissions_write on public.commerce_role_permissions for all to authenticated
  using (private.commerce_can_write(tenant_id) and private.commerce_is_owner(tenant_id))
  with check (private.commerce_can_write(tenant_id) and private.commerce_is_owner(tenant_id));

drop policy if exists commerce_employees_select on public.commerce_employees;
create policy commerce_employees_select on public.commerce_employees for select to authenticated
  using (
    private.commerce_has_permission(tenant_id,'team.view') and exists (
      select 1 from public.commerce_employee_stores es
      where es.tenant_id = commerce_employees.tenant_id and es.employee_id = commerce_employees.id
        and private.commerce_user_can_access_store(es.tenant_id,es.store_id)
    )
  );
drop policy if exists commerce_employees_write on public.commerce_employees;
create policy commerce_employees_write on public.commerce_employees for all to authenticated
  using (private.commerce_can_write(tenant_id) and private.commerce_has_permission(tenant_id,'team.manage'))
  with check (private.commerce_can_write(tenant_id) and private.commerce_has_permission(tenant_id,'team.manage'));

drop policy if exists commerce_employee_roles_select on public.commerce_employee_roles;
create policy commerce_employee_roles_select on public.commerce_employee_roles for select to authenticated
  using (private.commerce_has_permission(tenant_id,'team.view') and (
    private.commerce_is_owner(tenant_id) or exists (
      select 1 from public.commerce_employee_stores es
      where es.tenant_id = commerce_employee_roles.tenant_id and es.employee_id = commerce_employee_roles.employee_id
        and private.commerce_user_can_access_store(es.tenant_id,es.store_id)
    )
  ));
drop policy if exists commerce_employee_roles_write on public.commerce_employee_roles;
create policy commerce_employee_roles_write on public.commerce_employee_roles for all to authenticated
  using (private.commerce_can_write(tenant_id) and private.commerce_has_permission(tenant_id,'team.manage'))
  with check (private.commerce_can_write(tenant_id) and private.commerce_has_permission(tenant_id,'team.manage'));

drop policy if exists commerce_employee_stores_select on public.commerce_employee_stores;
create policy commerce_employee_stores_select on public.commerce_employee_stores for select to authenticated
  using (private.commerce_has_permission(tenant_id,'team.view') and private.commerce_user_can_access_store(tenant_id,store_id));
drop policy if exists commerce_employee_stores_write on public.commerce_employee_stores;
create policy commerce_employee_stores_write on public.commerce_employee_stores for all to authenticated
  using (private.commerce_can_write(tenant_id) and private.commerce_has_permission(tenant_id,'team.manage'))
  with check (private.commerce_can_write(tenant_id) and private.commerce_has_permission(tenant_id,'team.manage'));

drop policy if exists commerce_audit_events_select on public.commerce_audit_events;
create policy commerce_audit_events_select on public.commerce_audit_events for select to authenticated
  using (private.commerce_has_permission(tenant_id,'audit.view'));

-- Authenticated users can only read through scoped RLS; writes must pass the audited server APIs.
drop policy if exists commerce_stores_insert on public.commerce_stores;
drop policy if exists commerce_stores_update on public.commerce_stores;
drop policy if exists commerce_stores_delete on public.commerce_stores;
drop policy if exists commerce_roles_insert on public.commerce_roles;
drop policy if exists commerce_roles_update on public.commerce_roles;
drop policy if exists commerce_roles_delete on public.commerce_roles;
drop policy if exists commerce_role_permissions_write on public.commerce_role_permissions;
drop policy if exists commerce_employees_write on public.commerce_employees;
drop policy if exists commerce_employee_roles_write on public.commerce_employee_roles;
drop policy if exists commerce_employee_stores_write on public.commerce_employee_stores;

create or replace function public.complete_commerce_password_change(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.commerce_employees%rowtype;
begin
  select * into v_employee
  from public.commerce_employees
  where user_id = p_user_id and status = 'ACTIVE'
  limit 1;
  if not found then raise exception 'Active Commerce employee not found'; end if;

  update public.commerce_employees
  set must_change_password = false, updated_at = now()
  where id = v_employee.id;
  update public.profiles
  set must_change_password = false, updated_at = now()
  where id = p_user_id and role = 'COMMERCE_STAFF';
  if not found then raise exception 'Commerce profile not found'; end if;

  insert into public.commerce_audit_events (tenant_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (v_employee.tenant_id,p_user_id,'EMPLOYEE_PASSWORD_CHANGED','EMPLOYEE',v_employee.id::text,'{"firstLogin":true}'::jsonb);
end;
$$;

revoke all on function private.commerce_subscription_mode(uuid) from public, anon;
revoke all on function private.commerce_is_tenant_member(uuid) from public, anon;
revoke all on function private.commerce_is_owner(uuid) from public, anon;
revoke all on function private.commerce_has_permission(uuid,text) from public, anon;
revoke all on function private.commerce_user_can_access_store(uuid,uuid) from public, anon;
revoke all on function private.commerce_can_write(uuid) from public, anon;
grant execute on function private.commerce_subscription_mode(uuid), private.commerce_is_tenant_member(uuid), private.commerce_is_owner(uuid), private.commerce_has_permission(uuid,text), private.commerce_user_can_access_store(uuid,uuid), private.commerce_can_write(uuid) to authenticated, service_role;
revoke all on function private.provision_commerce_tenant() from public, anon, authenticated;
revoke all on function private.prevent_commerce_audit_mutation() from public, anon, authenticated;
revoke all on function private.audit_commerce_subscription_payment() from public, anon, authenticated;
revoke all on function public.complete_commerce_password_change(uuid) from public, anon, authenticated;
grant execute on function public.complete_commerce_password_change(uuid) to service_role;

commit;
