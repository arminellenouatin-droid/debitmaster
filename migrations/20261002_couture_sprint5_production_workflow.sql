-- DebitMaster: Sprint 5 pour l'activité « Atelier de couture ».
-- Production en atelier : fiches de fabrication, circuit d'étapes fixes, assignations et contrôle qualité.
begin;

-- 1. Table des Fiches de Fabrication
create table if not exists public.couture_production_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  workshop_site_id uuid not null references public.couture_sites(id) on delete restrict,
  source_boutique_site_id uuid references public.couture_sites(id) on delete set null,
  sale_id uuid references public.couture_sales(id) on delete set null,
  sale_line_id uuid references public.couture_sale_lines(id) on delete set null,
  card_number text not null check (card_number ~ '^FAB-[0-9]{4}-[0-9]{6}$'),
  card_type text not null check (card_type in ('COMMANDE', 'CONFECTION', 'RETOUCHE', 'STOCK_MANUFACTURE')),
  customer_id uuid references public.couture_customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  measurements_snapshot jsonb,
  model_id uuid references public.couture_models(id) on delete set null,
  range_id uuid references public.couture_ranges(id) on delete set null,
  size_id uuid references public.couture_sizes(id) on delete set null,
  color_id uuid references public.couture_colors(id) on delete set null,
  description text not null check (char_length(trim(description)) between 2 and 500),
  has_embroidery boolean not null default false,
  embroidery_type text not null default 'AUCUNE' check (embroidery_type in ('MAIN', 'MACHINE', 'AUCUNE')),
  priority text not null default 'NORMAL' check (priority in ('NORMAL', 'URGENT', 'VERY_URGENT')),
  status text not null default 'QUEUED' check (status in ('QUEUED', 'IN_PRODUCTION', 'QUALITY_CONTROL', 'PACKED', 'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
  current_step text not null default 'COUPE' check (current_step in ('COUPE', 'COUTURE', 'BRODERIE', 'FINITION_REPASSAGE', 'CONTROLE_QUALITE', 'EMBALLAGE', 'LIVRAISON')),
  target_delivery_date date,
  notes text,
  photo_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, card_number),
  unique (id, tenant_id)
);

create index if not exists couture_cards_tenant_workshop_idx
  on public.couture_production_cards (tenant_id, workshop_site_id, status);
create index if not exists couture_cards_tenant_sale_idx
  on public.couture_production_cards (tenant_id, sale_id);

-- 2. Table des Étapes de Fabrication
create table if not exists public.couture_production_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  card_id uuid not null,
  step_order integer not null check (step_order >= 1),
  step_type text not null check (step_type in ('COUPE', 'COUTURE', 'BRODERIE', 'FINITION_REPASSAGE', 'CONTROLE_QUALITE', 'EMBALLAGE', 'LIVRAISON')),
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
  assigned_employee_id uuid references public.couture_employees(id) on delete set null,
  assigned_worker_user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  foreign key (card_id, tenant_id) references public.couture_production_cards(id, tenant_id) on delete cascade,
  unique (card_id, step_order),
  unique (id, tenant_id)
);

create index if not exists couture_steps_tenant_card_idx
  on public.couture_production_steps (tenant_id, card_id);
create index if not exists couture_steps_tenant_worker_idx
  on public.couture_production_steps (tenant_id, assigned_employee_id, status);

-- 3. Table des Contrôles Qualité
create table if not exists public.couture_quality_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  card_id uuid not null,
  inspector_user_id uuid references auth.users(id) on delete set null,
  result text not null check (result in ('PASSED', 'REJECTED')),
  rejection_reason text,
  rejection_target_step text check (rejection_target_step in ('COUPE', 'COUTURE', 'BRODERIE', 'FINITION_REPASSAGE')),
  inspected_at timestamptz not null default now(),
  foreign key (card_id, tenant_id) references public.couture_production_cards(id, tenant_id) on delete cascade,
  unique (id, tenant_id)
);

create index if not exists couture_qc_tenant_card_idx
  on public.couture_quality_controls (tenant_id, card_id);

-- 4. Row Level Security & Politiques
alter table public.couture_production_cards enable row level security;
alter table public.couture_production_steps enable row level security;
alter table public.couture_quality_controls enable row level security;

revoke all on public.couture_production_cards, public.couture_production_steps, public.couture_quality_controls from anon, authenticated;

grant select on public.couture_production_cards, public.couture_production_steps, public.couture_quality_controls to authenticated;
grant select, insert, update, delete on public.couture_production_cards, public.couture_production_steps, public.couture_quality_controls to service_role;

drop policy if exists couture_production_cards_select on public.couture_production_cards;
create policy couture_production_cards_select on public.couture_production_cards
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_production_steps_select on public.couture_production_steps;
create policy couture_production_steps_select on public.couture_production_steps
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

drop policy if exists couture_quality_controls_select on public.couture_quality_controls;
create policy couture_quality_controls_select on public.couture_quality_controls
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
