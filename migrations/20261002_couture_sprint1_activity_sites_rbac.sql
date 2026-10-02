-- DebitMaster: Sprint 1 pour l'activité indépendante « Atelier de couture ».
-- Déclaration de l'activité, tarification 150 000 FCFA/mois, sites (boutiques/ateliers), rôles, permissions et onboarding.
begin;

-- 1. Contraintes d'activité sur companies et saas_plan_prices
alter table public.companies drop constraint if exists companies_activity_type_check;
alter table public.companies add constraint companies_activity_type_check
  check (activity_type = any (array['BUVETTE','BAR_RESTAURANT','NIGHTCLUB_LOUNGE','HOTEL_AUBERGE','BOUTIQUE_COMMERCE','ATELIER_COUTURE']));

alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_activity_code_check;
alter table public.saas_plan_prices add constraint saas_plan_prices_activity_code_check
  check (activity_code = any (array['BUVETTE','BAR_RESTAURANT','NIGHTCLUB_LOUNGE','HOTEL_AUBERGE','BOUTIQUE_COMMERCE','ATELIER_COUTURE']));

alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_plan_code_check;
alter table public.saas_plan_prices add constraint saas_plan_prices_plan_code_check
  check (plan_code = any (array['BUVETTE','BAR_RESTAURANT','HOTEL_AUBERGE','BOUTIQUE_COMMERCE','ATELIER_COUTURE']));

-- 2. Tarification officielle de l'activité : 150 000 FCFA / mois, 1 350 000 FCFA / an (3 mois offerts)
insert into public.saas_plan_prices (activity_code, plan_code, billing_period, price_xof, description, is_active)
values
  ('ATELIER_COUTURE','ATELIER_COUTURE','MONTHLY',150000,'Atelier de couture — formule mensuelle tout inclus',true),
  ('ATELIER_COUTURE','ATELIER_COUTURE','ANNUAL',1350000,'Atelier de couture — formule annuelle (25% réduction / 3 mois offerts)',true)
on conflict (activity_code, plan_code, billing_period) do nothing;

-- 3. Table des Sites (Boutiques de vente & Ateliers de fabrication)
create table if not exists public.couture_sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  site_type text not null default 'BOUTIQUE' check (site_type in ('BOUTIQUE','ATELIER')),
  country text not null default 'Togo' check (char_length(trim(country)) between 2 and 80),
  city text check (city is null or char_length(trim(city)) between 2 and 120),
  address text check (address is null or char_length(trim(address)) between 2 and 240),
  currency text not null default 'FCFA' check (currency in ('FCFA','XOF','XAF','EUR','USD','GHS','NGN')),
  phone text,
  photo_url text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists couture_sites_name_per_tenant_idx
  on public.couture_sites (tenant_id, lower(name));
create index if not exists couture_sites_tenant_type_idx
  on public.couture_sites (tenant_id, site_type);

-- 4. Table des Rôles
create table if not exists public.couture_roles (
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

-- 5. Table des Permissions par Rôle
create table if not exists public.couture_role_permissions (
  tenant_id uuid not null,
  role_id uuid not null,
  permission_key text not null check (permission_key = any (array[
    'dashboard.view','sites.view','sites.manage','team.view','team.manage','audit.view',
    'catalog.view','catalog.manage','customers.view','customers.manage',
    'sales.view','sales.create','sales.multi_currency',
    'production.view','production.manage','production.assign','production.quality_control',
    'piecework.view','piecework.manage','piecework.declare',
    'supplies.view','supplies.manage','supplies.request',
    'purchases.view','purchases.request','purchases.approve_small','purchases.approve_large',
    'petty_cash.view','petty_cash.spend','petty_cash.visa',
    'stock.view','stock.manage','stock.transfer',
    'inventory.view','inventory.count','inventory.validate',
    'treasury.view','accounting.view',
    'hr.view','hr.manage','attendance.view','attendance.track',
    'payroll.view','payroll.calculate','payroll.approve',
    'incentives.view','incentives.manage',
    'reports.view','reports.export'
  ])),
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key),
  foreign key (role_id, tenant_id) references public.couture_roles(id, tenant_id) on delete cascade
);

-- 6. Table des Collaborateurs Couture (avec métiers pour les ouvriers)
create table if not exists public.couture_employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  phone text not null,
  crafts text[] not null default '{}'::text[] check (crafts <@ array['COUPEUR','COUTURIER','BRODEUR_MAIN','BRODEUR_MACHINE','FINISSEUR']::text[]),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  must_change_password boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (id, tenant_id)
);
create index if not exists couture_employees_user_tenant_idx
  on public.couture_employees (user_id, tenant_id) where status = 'ACTIVE';

-- 7. Affectation Rôles aux Collaborateurs
create table if not exists public.couture_employee_roles (
  tenant_id uuid not null,
  employee_id uuid not null,
  role_id uuid not null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (employee_id, role_id),
  foreign key (employee_id, tenant_id) references public.couture_employees(id, tenant_id) on delete cascade,
  foreign key (role_id, tenant_id) references public.couture_roles(id, tenant_id) on delete restrict
);

-- 8. Affectation Sites aux Collaborateurs
create table if not exists public.couture_employee_sites (
  tenant_id uuid not null,
  employee_id uuid not null,
  site_id uuid not null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (employee_id, site_id),
  foreign key (employee_id, tenant_id) references public.couture_employees(id, tenant_id) on delete cascade,
  foreign key (site_id, tenant_id) references public.couture_sites(id, tenant_id) on delete cascade
);

-- 9. Journal d'Audit Immuable
create table if not exists public.couture_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists couture_audit_events_tenant_created_idx
  on public.couture_audit_events (tenant_id, created_at desc);
create index if not exists couture_audit_events_actor_created_idx
  on public.couture_audit_events (actor_user_id, created_at desc);

-- 10. Fonctions Privées de Sécurité et d'Autorisation
create or replace function private.couture_subscription_mode(p_tenant_id uuid)
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
  where c.id = p_tenant_id and c.activity_type = 'ATELIER_COUTURE' and c.deleted_at is null;
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

create or replace function private.couture_is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.couture_subscription_mode(p_tenant_id) <> 'BLOCKED'
    and (
      exists (select 1 from public.companies c where c.id = p_tenant_id and c.owner_user_id = (select auth.uid()) and c.activity_type = 'ATELIER_COUTURE' and c.deleted_at is null)
      or exists (select 1 from public.couture_employees e where e.tenant_id = p_tenant_id and e.user_id = (select auth.uid()) and e.status = 'ACTIVE' and e.must_change_password = false)
    );
$$;

create or replace function private.couture_is_owner(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_tenant_id and c.owner_user_id = (select auth.uid())
      and c.activity_type = 'ATELIER_COUTURE' and c.deleted_at is null
  );
$$;

create or replace function private.couture_has_permission(p_tenant_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.couture_is_tenant_member(p_tenant_id)
    and (
      private.couture_is_owner(p_tenant_id)
      or exists (
        select 1
        from public.couture_employees e
        join public.couture_employee_roles er on er.employee_id = e.id and er.tenant_id = e.tenant_id
        join public.couture_role_permissions rp on rp.role_id = er.role_id and rp.tenant_id = er.tenant_id
        where e.tenant_id = p_tenant_id and e.user_id = (select auth.uid())
          and e.status = 'ACTIVE' and rp.permission_key = p_permission_key
      )
    );
$$;

create or replace function private.couture_user_can_access_site(p_tenant_id uuid, p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.couture_is_owner(p_tenant_id)
    or exists (
      select 1 from public.couture_employee_sites es
      join public.couture_employees e on e.id = es.employee_id and e.tenant_id = es.tenant_id
      where es.tenant_id = p_tenant_id and es.site_id = p_site_id
        and e.user_id = (select auth.uid()) and e.status = 'ACTIVE' and e.must_change_password = false
    );
$$;

create or replace function private.couture_can_write(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.couture_is_tenant_member(p_tenant_id)
    and private.couture_subscription_mode(p_tenant_id) = 'ACTIVE';
$$;

-- 11. Trigger de provisionnement automatique du tenant Couture
create or replace function private.provision_couture_tenant()
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
  if new.activity_type <> 'ATELIER_COUTURE' then return new; end if;

  -- Création automatique de l'atelier central et de la boutique principale
  insert into public.couture_sites (tenant_id, name, site_type, country, currency, created_by)
  values
    (new.id, 'Atelier central', 'ATELIER', coalesce(new.country, 'Togo'), coalesce(new.currency, 'FCFA'), new.owner_user_id),
    (new.id, 'Boutique principale', 'BOUTIQUE', coalesce(new.country, 'Togo'), coalesce(new.currency, 'FCFA'), new.owner_user_id)
  on conflict do nothing;

  -- Création des rôles par défaut avec leurs permissions définies dans le PRD
  for v_role in
    select * from (values
      ('DIRECTEUR_GERANT','Directeur / Gérant','Délégation opérationnelle complète',array['dashboard.view','sites.view','sites.manage','team.view','team.manage','audit.view','catalog.view','catalog.manage','customers.view','customers.manage','sales.view','sales.create','sales.multi_currency','production.view','production.manage','production.assign','production.quality_control','piecework.view','piecework.manage','supplies.view','supplies.manage','supplies.request','purchases.view','purchases.request','purchases.approve_small','purchases.approve_large','petty_cash.view','petty_cash.spend','petty_cash.visa','stock.view','stock.manage','stock.transfer','inventory.view','inventory.count','inventory.validate','treasury.view','accounting.view','hr.view','hr.manage','attendance.view','attendance.track','payroll.view','payroll.calculate','payroll.approve','incentives.view','incentives.manage','reports.view','reports.export']::text[]),
      ('CHEF_AGENCE','Chef d’agence','Responsable d’une boutique de vente',array['dashboard.view','sites.view','team.view','catalog.view','customers.view','customers.manage','sales.view','sales.create','sales.multi_currency','stock.view','stock.manage','stock.transfer','inventory.view','inventory.count','attendance.view','attendance.track','incentives.view','reports.view']::text[]),
      ('VENDEUR','Vendeur / Vendeuse','Vente comptoir, commandes et encaissement',array['dashboard.view','sites.view','catalog.view','customers.view','customers.manage','sales.view','sales.create','sales.multi_currency','stock.view','attendance.track','incentives.view','reports.view']::text[]),
      ('CHEF_ATELIER','Chef d’atelier','Pilotage de la fabrication et des ouvriers',array['dashboard.view','sites.view','team.view','catalog.view','customers.view','production.view','production.manage','production.assign','production.quality_control','piecework.view','piecework.manage','supplies.view','supplies.request','purchases.request','stock.view','stock.transfer','attendance.view','attendance.track','reports.view']::text[]),
      ('OUVRIER','Ouvrier de production','Coupe, couture, broderie et finition à la tâche',array['dashboard.view','production.view','piecework.view','piecework.declare','attendance.track']::text[]),
      ('MAGASINIER_ATELIER','Magasinier atelier','Stock tissus & fournitures, petite caisse',array['dashboard.view','sites.view','supplies.view','supplies.manage','supplies.request','purchases.request','petty_cash.view','petty_cash.spend','inventory.view','inventory.count','attendance.track']::text[]),
      ('MAGASINIER_BOUTIQUE','Magasinier boutique','Stock produits finis et réceptions atelier',array['dashboard.view','sites.view','catalog.view','stock.view','stock.manage','stock.transfer','inventory.view','inventory.count','attendance.track']::text[]),
      ('ACHETEUR','Chargé des achats','Fournisseurs et commandes de fournitures',array['dashboard.view','sites.view','supplies.view','purchases.view','purchases.request','attendance.track','reports.view']::text[]),
      ('COMPTABLE','Comptable','Comptabilité SYSCOHADA, trésorerie et visa achats < 50k',array['dashboard.view','sites.view','sales.view','supplies.view','purchases.view','purchases.approve_small','petty_cash.view','petty_cash.visa','treasury.view','accounting.view','payroll.view','payroll.calculate','reports.view','reports.export']::text[]),
      ('RH','Responsable RH / Direction','Personnel, paie, primes et visa achats ≥ 50k',array['dashboard.view','sites.view','team.view','team.manage','purchases.view','purchases.approve_large','hr.view','hr.manage','attendance.view','payroll.view','payroll.approve','incentives.view','incentives.manage','reports.view']::text[]),
      ('INVENTAIRE','Responsable d’inventaire','Comptages physiques boutiques et atelier',array['dashboard.view','sites.view','catalog.view','stock.view','supplies.view','inventory.view','inventory.count','inventory.validate','attendance.track','reports.view']::text[])
    ) as defaults(role_key, role_name, role_description, permission_keys)
  loop
    insert into public.couture_roles (tenant_id, role_key, name, description, is_system)
    values (new.id, v_role.role_key, v_role.role_name, v_role.role_description, true)
    on conflict (tenant_id, role_key) do update set name = excluded.name, description = excluded.description
    returning id into v_role_id;

    foreach v_permission in array v_role.permission_keys loop
      insert into public.couture_role_permissions (tenant_id, role_id, permission_key)
      values (new.id, v_role_id, v_permission)
      on conflict (role_id, permission_key) do nothing;
    end loop;
  end loop;

  insert into public.couture_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (new.id, new.owner_user_id, 'ESTABLISHMENT_CREATED', 'COMPANY', new.id::text, jsonb_build_object('activity_type', new.activity_type));

  return new;
end;
$$;

drop trigger if exists companies_provision_couture_tenant on public.companies;
create trigger companies_provision_couture_tenant
after insert on public.companies
for each row execute function private.provision_couture_tenant();

-- 12. Immuabilité du journal d'audit
create or replace function private.prevent_couture_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'COUTURE_AUDIT_EVENTS_IMMUTABLE';
end;
$$;

drop trigger if exists couture_audit_events_immutable on public.couture_audit_events;
create trigger couture_audit_events_immutable
before update or delete on public.couture_audit_events
for each row execute function private.prevent_couture_audit_mutation();

-- 13. Audit des paiements d'abonnement pour l'activité Couture
create or replace function private.audit_couture_subscription_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
  v_action text;
begin
  if not exists (select 1 from public.companies c where c.id = new.tenant_id and c.activity_type = 'ATELIER_COUTURE') then
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
  insert into public.couture_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (new.tenant_id, v_actor_user_id, v_action, 'SUBSCRIPTION_PAYMENT', new.id::text,
    jsonb_build_object('plan', new.plan, 'billing_period', new.billing_period, 'amount', new.amount, 'currency', new.currency, 'status', new.status));
  return new;
end;
$$;

drop trigger if exists couture_subscription_payment_audit_insert on public.saas_subscription_payments;
create trigger couture_subscription_payment_audit_insert after insert on public.saas_subscription_payments
for each row execute function private.audit_couture_subscription_payment();

drop trigger if exists couture_subscription_payment_audit_status on public.saas_subscription_payments;
create trigger couture_subscription_payment_audit_status after update of status on public.saas_subscription_payments
for each row when (old.status is distinct from new.status) execute function private.audit_couture_subscription_payment();

-- 14. Activation de Row Level Security et Révocation / Attribution des Droits
alter table public.couture_sites enable row level security;
alter table public.couture_roles enable row level security;
alter table public.couture_role_permissions enable row level security;
alter table public.couture_employees enable row level security;
alter table public.couture_employee_roles enable row level security;
alter table public.couture_employee_sites enable row level security;
alter table public.couture_audit_events enable row level security;

revoke all on public.couture_sites, public.couture_roles, public.couture_role_permissions,
  public.couture_employees, public.couture_employee_roles, public.couture_employee_sites, public.couture_audit_events from anon, authenticated;

grant select on public.couture_sites, public.couture_roles, public.couture_role_permissions,
  public.couture_employees, public.couture_employee_roles, public.couture_employee_sites, public.couture_audit_events to authenticated;

grant select, insert, update, delete on public.couture_sites, public.couture_roles, public.couture_role_permissions,
  public.couture_employees, public.couture_employee_roles, public.couture_employee_sites to service_role;

grant select, insert on public.couture_audit_events to service_role;

-- 15. Politiques RLS Explicites et Minimales
drop policy if exists couture_sites_select on public.couture_sites;
create policy couture_sites_select on public.couture_sites
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_roles_select on public.couture_roles;
create policy couture_roles_select on public.couture_roles
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_role_permissions_select on public.couture_role_permissions;
create policy couture_role_permissions_select on public.couture_role_permissions
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_employees_select on public.couture_employees;
create policy couture_employees_select on public.couture_employees
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_employee_roles_select on public.couture_employee_roles;
create policy couture_employee_roles_select on public.couture_employee_roles
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_employee_sites_select on public.couture_employee_sites;
create policy couture_employee_sites_select on public.couture_employee_sites
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_audit_events_select on public.couture_audit_events;
create policy couture_audit_events_select on public.couture_audit_events
  for select to authenticated
  using (private.couture_is_owner(tenant_id) or private.couture_has_permission(tenant_id, 'audit.view'));

commit;
