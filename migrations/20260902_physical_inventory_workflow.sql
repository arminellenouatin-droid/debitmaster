begin;

create table if not exists public.inventory_audits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  title varchar(160) not null,
  scope text not null default 'ALL_STOCK' check (scope in ('ALL_STOCK','CATEGORY','STORE')),
  inventory_type text not null default 'FULL' check (inventory_type in ('FULL','CYCLIC','SPOT')),
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','APPROVED','CLOSED')),
  counted_at timestamptz not null default now(),
  submitted_at timestamptz,
  validated_at timestamptz,
  validated_by uuid references auth.users(id),
  closed_at timestamptz,
  created_by uuid not null references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.inventory_audits(id) on delete cascade,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  theoretical_quantity integer not null default 0,
  physical_quantity integer not null default 0 check (physical_quantity >= 0),
  unit_cost integer not null default 0 check (unit_cost >= 0),
  variance_quantity integer generated always as (theoretical_quantity - physical_quantity) stored,
  variance_value integer generated always as ((theoretical_quantity - physical_quantity) * unit_cost) stored,
  cause text,
  justification text,
  counted_by uuid references auth.users(id),
  counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_id, product_id)
);

create index if not exists inventory_audits_tenant_status_idx on public.inventory_audits(tenant_id, status, created_at desc);
create index if not exists inventory_audit_items_audit_idx on public.inventory_audit_items(audit_id);
create index if not exists inventory_audit_items_tenant_product_idx on public.inventory_audit_items(tenant_id, product_id);

alter table public.inventory_audits enable row level security;
alter table public.inventory_audit_items enable row level security;

drop policy if exists inventory_audits_select on public.inventory_audits;
create policy inventory_audits_select on public.inventory_audits for select to authenticated using (private.has_tenant_permission(tenant_id, 'stock.audit') or private.has_tenant_permission(tenant_id, 'reports.view'));
drop policy if exists inventory_audits_insert on public.inventory_audits;
create policy inventory_audits_insert on public.inventory_audits for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'stock.audit') and created_by = (select auth.uid()));
drop policy if exists inventory_audits_update on public.inventory_audits;
create policy inventory_audits_update on public.inventory_audits for update to authenticated using (private.has_tenant_permission(tenant_id, 'stock.audit') or (validated_by = (select auth.uid()) and status in ('SUBMITTED','APPROVED'))) with check (private.has_tenant_permission(tenant_id, 'stock.audit') or (validated_by = (select auth.uid()) and status in ('APPROVED','CLOSED')));

drop policy if exists inventory_audit_items_select on public.inventory_audit_items;
create policy inventory_audit_items_select on public.inventory_audit_items for select to authenticated using (private.has_tenant_permission(tenant_id, 'stock.audit') or private.has_tenant_permission(tenant_id, 'reports.view'));
drop policy if exists inventory_audit_items_insert on public.inventory_audit_items;
create policy inventory_audit_items_insert on public.inventory_audit_items for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'stock.audit') and counted_by = (select auth.uid()));
drop policy if exists inventory_audit_items_update on public.inventory_audit_items;
create policy inventory_audit_items_update on public.inventory_audit_items for update using (private.has_tenant_permission(tenant_id, 'stock.audit')) with check (private.has_tenant_permission(tenant_id, 'stock.audit'));

commit;
