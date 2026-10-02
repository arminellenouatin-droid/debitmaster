-- DebitMaster: Sprint 2 pour l'activité « Atelier de couture ».
-- Catalogue mode (modèles, gammes, tailles, couleurs, grille de prix, accessoires) et Fiches clients avec mensurations.
begin;

-- 1. Table des Modèles de vêtements
create table if not exists public.couture_models (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text,
  gender text not null default 'UNISEXE' check (gender in ('HOMME','FEMME','ENFANT','UNISEXE')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists couture_models_tenant_name_idx
  on public.couture_models (tenant_id, lower(name));

-- 2. Table des Gammes
create table if not exists public.couture_ranges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 60),
  description text,
  rank integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists couture_ranges_tenant_name_idx
  on public.couture_ranges (tenant_id, lower(name));

-- 3. Table de la Grille de Prix (Modèle x Gamme)
create table if not exists public.couture_price_grid (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  model_id uuid not null,
  range_id uuid not null,
  price_adult_xof bigint not null check (price_adult_xof >= 0),
  price_child_xof bigint not null check (price_child_xof >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (model_id, tenant_id) references public.couture_models(id, tenant_id) on delete cascade,
  foreign key (range_id, tenant_id) references public.couture_ranges(id, tenant_id) on delete cascade,
  unique (tenant_id, model_id, range_id),
  unique (id, tenant_id)
);
create index if not exists couture_price_grid_tenant_model_idx
  on public.couture_price_grid (tenant_id, model_id);

-- 4. Table des Tailles
create table if not exists public.couture_sizes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  code text not null check (char_length(trim(code)) between 1 and 20),
  name text not null check (char_length(trim(name)) between 1 and 40),
  rank integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists couture_sizes_tenant_code_idx
  on public.couture_sizes (tenant_id, upper(code));

-- 5. Table des Couleurs
create table if not exists public.couture_colors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 50),
  hex_code text check (hex_code is null or hex_code ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists couture_colors_tenant_name_idx
  on public.couture_colors (tenant_id, lower(name));

-- 6. Table des Accessoires de mode
create table if not exists public.couture_accessories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  category text not null default 'AUTRE' check (category in ('SAC','CHAUSSETTES','LUNETTES','MANCHETTES','MONTRE','AUTRE')),
  selling_price_xof bigint not null check (selling_price_xof >= 0),
  purchase_cost_xof bigint check (purchase_cost_xof is null or purchase_cost_xof >= 0),
  stock_alert_threshold integer not null default 5 check (stock_alert_threshold >= 0),
  photo_url text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create index if not exists couture_accessories_tenant_cat_idx
  on public.couture_accessories (tenant_id, category);

-- 7. Table des Clients avec Mensurations
create table if not exists public.couture_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  phone text not null check (char_length(trim(phone)) between 6 and 30),
  email text check (email is null or char_length(trim(email)) between 3 and 120),
  gender text not null default 'HOMME' check (gender in ('HOMME','FEMME','ENFANT','UNISEXE')),
  birthday date,
  notes text,
  measurements jsonb not null default '{}'::jsonb check (jsonb_typeof(measurements) = 'object'),
  habitual_beneficiaries jsonb not null default '[]'::jsonb check (jsonb_typeof(habitual_beneficiaries) = 'array'),
  photo_url text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists couture_customers_tenant_phone_idx
  on public.couture_customers (tenant_id, phone);
create index if not exists couture_customers_tenant_name_idx
  on public.couture_customers (tenant_id, lower(last_name), lower(first_name));

-- 8. Mise à jour de la fonction de provisionnement pour initialiser tailles et gammes de base
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
  v_range record;
  v_size record;
  v_color record;
  v_model record;
  v_model_id uuid;
  v_range_id uuid;
  v_leader_id uuid;
  v_vip_id uuid;
  v_royale_id uuid;
  v_pres_id uuid;
begin
  if new.activity_type <> 'ATELIER_COUTURE' then return new; end if;

  -- Création automatique de l'atelier central et de la boutique principale
  insert into public.couture_sites (tenant_id, name, site_type, country, currency, created_by)
  values
    (new.id, 'Atelier central', 'ATELIER', coalesce(new.country, 'Togo'), coalesce(new.currency, 'FCFA'), new.owner_user_id),
    (new.id, 'Boutique principale', 'BOUTIQUE', coalesce(new.country, 'Togo'), coalesce(new.currency, 'FCFA'), new.owner_user_id)
  on conflict do nothing;

  -- Tailles standard
  for v_size in
    select * from (values
      ('S','S (Small)',1),
      ('M','M (Medium)',2),
      ('MK','MK (Medium King)',3),
      ('L','L (Large)',4),
      ('XL','XL (Extra Large)',5),
      ('2XL','2XL (Double XL)',6),
      ('3XL','3XL (Triple XL)',7),
      ('SUR_MESURE','Sur mesure',8)
    ) as s(code, name, rank)
  loop
    insert into public.couture_sizes (tenant_id, code, name, rank)
    values (new.id, v_size.code, v_size.name, v_size.rank)
    on conflict (tenant_id, upper(code)) do nothing;
  end loop;

  -- Couleurs standard
  for v_color in
    select * from (values
      ('Blanc','#FFFFFF'),
      ('Noir','#000000'),
      ('Bleu nuit','#0B1B3D'),
      ('Bordeaux','#5B0E2D'),
      ('Doré','#D4AF37'),
      ('Gris argenté','#A8A9AD'),
      ('Beige','#F5F5DC')
    ) as c(name, hex_code)
  loop
    insert into public.couture_colors (tenant_id, name, hex_code)
    values (new.id, v_color.name, v_color.hex_code)
    on conflict (tenant_id, lower(name)) do nothing;
  end loop;

  -- Gammes standard
  for v_range in
    select * from (values
      ('Leader',1,'Gamme quotidienne sobre et élégante'),
      ('VIP',2,'Gamme supérieure avec finitions soignées'),
      ('Royale',3,'Gamme prestige avec broderies et tissus nobles'),
      ('Présidentiel',4,'Gamme haute couture d’exception')
    ) as r(name, rank, description)
  loop
    insert into public.couture_ranges (tenant_id, name, rank, description, created_by)
    values (new.id, v_range.name, v_range.rank, v_range.description, new.owner_user_id)
    on conflict (tenant_id, lower(name)) do nothing;
  end loop;

  -- Si l'établissement est « DISTINCTION » (ou contient DISTINCTION), pré-charger les modèles et la grille de prix
  if upper(new.name) like '%DISTINCTION%' then
    select id into v_leader_id from public.couture_ranges where tenant_id = new.id and lower(name) = 'leader' limit 1;
    select id into v_vip_id from public.couture_ranges where tenant_id = new.id and lower(name) = 'vip' limit 1;
    select id into v_royale_id from public.couture_ranges where tenant_id = new.id and lower(name) = 'royale' limit 1;
    select id into v_pres_id from public.couture_ranges where tenant_id = new.id and lower(name) = 'présidentiel' limit 1;

    for v_model in
      select * from (values
        ('Goodluck','HOMME','Ensemble tunique col Mao et pantalon habillé',120000,200000,350000,500000),
        ('Danshiki','HOMME','Tunique traditionnelle ample brodée',150000,350000,500000,700000),
        ('Agbada','HOMME','Grand boubou 3 pièces royal',300000,500000,700000,900000),
        ('Abacost','HOMME','Costume africain contemporain col officier',250000,400000,600000,900000),
        ('Robe','FEMME','Robe de cérémonie ou soirée sur mesure',100000,200000,350000,600000),
        ('Boubou','FEMME','Grand boubou féminin brodé et orné',100000,200000,350000,500000)
      ) as m(name, gender, description, p_leader, p_vip, p_royale, p_pres)
    loop
      insert into public.couture_models (tenant_id, name, gender, description, created_by)
      values (new.id, v_model.name, v_model.gender, v_model.description, new.owner_user_id)
      on conflict (tenant_id, lower(name)) do update set description = excluded.description
      returning id into v_model_id;

      if v_leader_id is not null then
        insert into public.couture_price_grid (tenant_id, model_id, range_id, price_adult_xof, price_child_xof, created_by)
        values (new.id, v_model_id, v_leader_id, v_model.p_leader, round(v_model.p_leader / 2), new.owner_user_id)
        on conflict (tenant_id, model_id, range_id) do update set price_adult_xof = excluded.price_adult_xof, price_child_xof = excluded.price_child_xof;
      end if;
      if v_vip_id is not null then
        insert into public.couture_price_grid (tenant_id, model_id, range_id, price_adult_xof, price_child_xof, created_by)
        values (new.id, v_model_id, v_vip_id, v_model.p_vip, round(v_model.p_vip / 2), new.owner_user_id)
        on conflict (tenant_id, model_id, range_id) do update set price_adult_xof = excluded.price_adult_xof, price_child_xof = excluded.price_child_xof;
      end if;
      if v_royale_id is not null then
        insert into public.couture_price_grid (tenant_id, model_id, range_id, price_adult_xof, price_child_xof, created_by)
        values (new.id, v_model_id, v_royale_id, v_model.p_royale, round(v_model.p_royale / 2), new.owner_user_id)
        on conflict (tenant_id, model_id, range_id) do update set price_adult_xof = excluded.price_adult_xof, price_child_xof = excluded.price_child_xof;
      end if;
      if v_pres_id is not null then
        insert into public.couture_price_grid (tenant_id, model_id, range_id, price_adult_xof, price_child_xof, created_by)
        values (new.id, v_model_id, v_pres_id, v_model.p_pres, round(v_model.p_pres / 2), new.owner_user_id)
        on conflict (tenant_id, model_id, range_id) do update set price_adult_xof = excluded.price_adult_xof, price_child_xof = excluded.price_child_xof;
      end if;
    end loop;
  end if;

  -- Création des 11 rôles par défaut
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

-- 9. Row Level Security & Politiques
alter table public.couture_models enable row level security;
alter table public.couture_ranges enable row level security;
alter table public.couture_price_grid enable row level security;
alter table public.couture_sizes enable row level security;
alter table public.couture_colors enable row level security;
alter table public.couture_accessories enable row level security;
alter table public.couture_customers enable row level security;

revoke all on public.couture_models, public.couture_ranges, public.couture_price_grid,
  public.couture_sizes, public.couture_colors, public.couture_accessories, public.couture_customers from anon, authenticated;

grant select on public.couture_models, public.couture_ranges, public.couture_price_grid,
  public.couture_sizes, public.couture_colors, public.couture_accessories, public.couture_customers to authenticated;

grant select, insert, update, delete on public.couture_models, public.couture_ranges, public.couture_price_grid,
  public.couture_sizes, public.couture_colors, public.couture_accessories, public.couture_customers to service_role;

-- Politiques de lecture
drop policy if exists couture_models_select on public.couture_models;
create policy couture_models_select on public.couture_models
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_ranges_select on public.couture_ranges;
create policy couture_ranges_select on public.couture_ranges
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_price_grid_select on public.couture_price_grid;
create policy couture_price_grid_select on public.couture_price_grid
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_sizes_select on public.couture_sizes;
create policy couture_sizes_select on public.couture_sizes
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_colors_select on public.couture_colors;
create policy couture_colors_select on public.couture_colors
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_accessories_select on public.couture_accessories;
create policy couture_accessories_select on public.couture_accessories
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_customers_select on public.couture_customers;
create policy couture_customers_select on public.couture_customers
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
