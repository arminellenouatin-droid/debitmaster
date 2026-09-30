-- DebitMaster Commerce, Sprint 2: isolated catalogue, clients and suppliers.
-- This migration intentionally does not alter legacy activity tables or flows.
begin;

-- V1 Commerce is FCFA-only. The sales/inventory modules are not yet active.
update public.companies
set currency = 'XOF'
where activity_type = 'BOUTIQUE_COMMERCE'
  and currency is distinct from 'XOF';

create table if not exists public.commerce_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  parent_id uuid,
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text,
  color text not null default '#0f766e' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon_key text not null default 'tag' check (icon_key ~ '^[a-z][a-z0-9_-]{0,39}$'),
  sort_order integer not null default 0 check (sort_order between -100000 and 100000),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (parent_id, tenant_id) references public.commerce_categories(id, tenant_id) on delete restrict
);
alter table public.commerce_categories add column if not exists color text not null default '#0f766e';
alter table public.commerce_categories add column if not exists icon_key text not null default 'tag';
create unique index if not exists commerce_categories_active_sibling_name_idx
  on public.commerce_categories (tenant_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where status = 'ACTIVE';
create index if not exists commerce_categories_parent_idx on public.commerce_categories (tenant_id, parent_id, sort_order, lower(name));

create table if not exists public.commerce_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  supplier_code text check (supplier_code is null or char_length(trim(supplier_code)) between 1 and 40),
  name text not null check (char_length(trim(name)) between 2 and 160),
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  country text,
  tax_number text,
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 365),
  lead_time_days integer check (lead_time_days is null or lead_time_days between 0 and 365),
  delivery_score numeric(4,2) check (delivery_score is null or delivery_score between 0 and 5),
  quality_score numeric(4,2) check (quality_score is null or quality_score between 0 and 5),
  notes text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists commerce_suppliers_code_per_tenant_idx
  on public.commerce_suppliers (tenant_id, lower(supplier_code)) where supplier_code is not null;
create index if not exists commerce_suppliers_name_search_idx on public.commerce_suppliers (tenant_id, lower(name));

create table if not exists public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  category_id uuid not null,
  primary_supplier_id uuid,
  internal_code text not null check (char_length(trim(internal_code)) between 1 and 50),
  barcode text check (barcode is null or char_length(trim(barcode)) between 3 and 80),
  supplier_reference text check (supplier_reference is null or char_length(trim(supplier_reference)) <= 80),
  name text not null check (char_length(trim(name)) between 2 and 180),
  description text,
  brand text check (brand is null or char_length(trim(brand)) <= 100),
  base_unit text not null check (char_length(trim(base_unit)) between 1 and 30),
  packages jsonb not null default '[]'::jsonb check (jsonb_typeof(packages) = 'array' and jsonb_array_length(packages) <= 30),
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array' and jsonb_array_length(variants) <= 20),
  photo_paths jsonb not null default '[]'::jsonb check (jsonb_typeof(photo_paths) = 'array' and jsonb_array_length(photo_paths) <= 5),
  purchase_price_xof bigint check (purchase_price_xof is null or purchase_price_xof >= 0),
  weighted_avg_cost_xof bigint check (weighted_avg_cost_xof is null or weighted_avg_cost_xof >= 0),
  price_retail_xof bigint not null check (price_retail_xof >= 0),
  price_semi_wholesale_xof bigint check (price_semi_wholesale_xof is null or price_semi_wholesale_xof >= 0),
  price_wholesale_xof bigint check (price_wholesale_xof is null or price_wholesale_xof >= 0),
  tax_rate_basis_points integer not null default 0 check (tax_rate_basis_points between 0 and 10000),
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  max_stock numeric(14,3) check (max_stock is null or max_stock >= 0),
  reorder_point numeric(14,3) not null default 0 check (reorder_point >= 0),
  track_serial boolean not null default false,
  track_lot boolean not null default false,
  track_expiry boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (category_id, tenant_id) references public.commerce_categories(id, tenant_id) on delete restrict,
  foreign key (primary_supplier_id, tenant_id) references public.commerce_suppliers(id, tenant_id) on delete restrict,
  check (max_stock is null or max_stock >= min_stock)
);
create unique index if not exists commerce_products_code_per_tenant_idx on public.commerce_products (tenant_id, lower(internal_code));
create unique index if not exists commerce_products_barcode_per_tenant_idx on public.commerce_products (tenant_id, barcode) where barcode is not null;
create index if not exists commerce_products_name_search_idx on public.commerce_products (tenant_id, lower(name));
create index if not exists commerce_products_category_idx on public.commerce_products (tenant_id, category_id, status);
create index if not exists commerce_products_supplier_idx on public.commerce_products (tenant_id, primary_supplier_id) where primary_supplier_id is not null;

create table if not exists public.commerce_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  customer_code text check (customer_code is null or char_length(trim(customer_code)) between 1 and 40),
  customer_type text not null default 'INDIVIDUAL' check (customer_type in ('INDIVIDUAL','BUSINESS')),
  display_name text not null check (char_length(trim(display_name)) between 2 and 160),
  business_name text,
  phone text,
  email text,
  address text,
  city text,
  country text,
  tax_number text,
  customer_category text,
  price_list text not null default 'RETAIL' check (price_list in ('RETAIL','SEMI_WHOLESALE','WHOLESALE')),
  credit_limit_xof bigint not null default 0 check (credit_limit_xof >= 0),
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 365),
  loyalty_points integer not null default 0 check (loyalty_points >= 0),
  is_walk_in boolean not null default false,
  notes text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index if not exists commerce_customers_code_per_tenant_idx
  on public.commerce_customers (tenant_id, lower(customer_code)) where customer_code is not null;
create unique index if not exists commerce_customers_walk_in_per_tenant_idx
  on public.commerce_customers (tenant_id) where is_walk_in;
create index if not exists commerce_customers_name_search_idx on public.commerce_customers (tenant_id, lower(display_name));
create index if not exists commerce_customers_phone_idx on public.commerce_customers (tenant_id, phone) where phone is not null;

create table if not exists public.commerce_product_price_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null,
  changed_by uuid references auth.users(id) on delete set null,
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (product_id, tenant_id) references public.commerce_products(id, tenant_id) on delete restrict
);
create index if not exists commerce_product_price_history_lookup_idx on public.commerce_product_price_history (tenant_id, product_id, created_at desc);

-- The rate limit stores only a hashed user/tenant/route/window key, not IP addresses or PII.
create table if not exists public.commerce_request_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null
);
create index if not exists commerce_request_limits_expiry_idx on public.commerce_request_limits (expires_at);

create or replace function public.consume_commerce_rate_limit(p_key_hash text, p_limit integer, p_expires_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid Commerce rate limit parameters';
  end if;
  delete from public.commerce_request_limits where expires_at < now() - interval '1 hour';
  insert into public.commerce_request_limits (key_hash, request_count, expires_at)
  values (p_key_hash, 1, greatest(p_expires_at, now() + interval '1 minute'))
  on conflict (key_hash) do update
    set request_count = public.commerce_request_limits.request_count + 1,
        expires_at = excluded.expires_at
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;

create or replace function private.audit_commerce_catalog_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_tenant_id uuid;
  v_entity_id text;
  v_actor_user_id uuid;
  v_entity_type text;
  v_action text;
  v_changed_fields jsonb := '[]'::jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_tenant_id := (v_row ->> 'tenant_id')::uuid;
  v_entity_id := v_row ->> 'id';
  v_actor_user_id := coalesce(nullif(v_row ->> 'updated_by','')::uuid, nullif(v_row ->> 'created_by','')::uuid, (select auth.uid()));
  v_entity_type := case tg_table_name
    when 'commerce_categories' then 'CATEGORY'
    when 'commerce_products' then 'PRODUCT'
    when 'commerce_customers' then 'CUSTOMER'
    when 'commerce_suppliers' then 'SUPPLIER'
    else 'COMMERCE_CATALOG'
  end;
  v_action := case
    when tg_op = 'INSERT' then v_entity_type || '_CREATED'
    when tg_op = 'DELETE' then v_entity_type || '_DELETED'
    when coalesce(v_row ->> 'status','') = 'ARCHIVED' and coalesce(to_jsonb(old) ->> 'status','') <> 'ARCHIVED' then v_entity_type || '_ARCHIVED'
    else v_entity_type || '_UPDATED'
  end;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb) into v_changed_fields
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('updated_at','updated_by');
    if v_changed_fields = '[]'::jsonb then return new; end if;
  end if;
  insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_tenant_id, v_actor_user_id, v_action, v_entity_type, v_entity_id,
    jsonb_build_object('changed_fields', v_changed_fields));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.capture_commerce_product_price_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := '{}'::jsonb;
  v_after jsonb;
  v_changed boolean := false;
  v_actor_user_id uuid;
  v_history_id uuid;
begin
  v_after := jsonb_build_object(
    'purchase_price_xof', new.purchase_price_xof,
    'weighted_avg_cost_xof', new.weighted_avg_cost_xof,
    'price_retail_xof', new.price_retail_xof,
    'price_semi_wholesale_xof', new.price_semi_wholesale_xof,
    'price_wholesale_xof', new.price_wholesale_xof,
    'tax_rate_basis_points', new.tax_rate_basis_points
  );
  if tg_op = 'INSERT' then
    v_changed := true;
  else
    v_before := jsonb_build_object(
      'purchase_price_xof', old.purchase_price_xof,
      'weighted_avg_cost_xof', old.weighted_avg_cost_xof,
      'price_retail_xof', old.price_retail_xof,
      'price_semi_wholesale_xof', old.price_semi_wholesale_xof,
      'price_wholesale_xof', old.price_wholesale_xof,
      'tax_rate_basis_points', old.tax_rate_basis_points
    );
    v_changed := v_before is distinct from v_after;
  end if;
  if v_changed then
    v_actor_user_id := coalesce(new.updated_by, new.created_by);
    insert into public.commerce_product_price_history (tenant_id, product_id, changed_by, before_values, after_values)
    values (new.tenant_id, new.id, v_actor_user_id, v_before, v_after)
    returning id into v_history_id;
    if tg_op = 'UPDATE' then
      insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
      values (new.tenant_id, v_actor_user_id, 'PRODUCT_PRICE_CHANGED', 'PRODUCT', new.id::text,
        jsonb_build_object('price_history_id', v_history_id::text));
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.ensure_commerce_walk_in_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.activity_type = 'BOUTIQUE_COMMERCE' then
    insert into public.commerce_customers (tenant_id, customer_code, customer_type, display_name, price_list, is_walk_in, created_by)
    values (new.id, 'COMPTOIR', 'INDIVIDUAL', 'Client comptoir', 'RETAIL', true, new.owner_user_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Atomic category merge: retain child subcategories, reassign products, then archive the empty source in one DB transaction.
create or replace function public.merge_commerce_category(p_tenant_id uuid, p_source_category_id uuid, p_target_category_id uuid, p_actor_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_source_category_id = p_target_category_id then raise exception 'Source and target categories must differ'; end if;
  if not exists (
    select 1 from public.companies c where c.id = p_tenant_id and c.owner_user_id = p_actor_user_id
      and c.activity_type = 'BOUTIQUE_COMMERCE' and c.deleted_at is null
      and private.commerce_subscription_mode(p_tenant_id) = 'ACTIVE'
  ) then raise exception 'Owner or active subscription required'; end if;
  if not exists (select 1 from public.commerce_categories where id = p_source_category_id and tenant_id = p_tenant_id and status = 'ACTIVE')
     or not exists (select 1 from public.commerce_categories where id = p_target_category_id and tenant_id = p_tenant_id and status = 'ACTIVE')
  then raise exception 'Active categories in the same tenant are required'; end if;
  if exists (
    with recursive descendants(id) as (
      select id from public.commerce_categories where tenant_id = p_tenant_id and parent_id = p_source_category_id
      union all
      select c.id from public.commerce_categories c join descendants d on c.parent_id = d.id where c.tenant_id = p_tenant_id
    ) select 1 from descendants where id = p_target_category_id
  ) then raise exception 'Target category cannot be a descendant of source'; end if;

  update public.commerce_products set category_id = p_target_category_id, updated_by = p_actor_user_id, updated_at = now()
  where tenant_id = p_tenant_id and category_id = p_source_category_id;
  update public.commerce_categories set parent_id = p_target_category_id, updated_by = p_actor_user_id, updated_at = now()
  where tenant_id = p_tenant_id and parent_id = p_source_category_id;
  update public.commerce_categories set status = 'ARCHIVED', updated_by = p_actor_user_id, updated_at = now()
  where id = p_source_category_id and tenant_id = p_tenant_id;
end;
$$;

-- Atomic category import. Resolve each path from its root, creating missing levels and updating existing active paths.
create or replace function public.import_commerce_categories(p_tenant_id uuid, p_actor_user_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_path jsonb;
  v_segment text;
  v_parent_id uuid;
  v_category_id uuid;
  v_status text;
  v_depth integer;
  v_position integer;
  v_sort_order integer;
  v_description text;
  v_color text;
  v_icon_key text;
  v_count integer := 0;
  v_affected integer;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 500 then
    raise exception 'Import must contain between 1 and 500 categories';
  end if;
  if private.commerce_subscription_mode(p_tenant_id) <> 'ACTIVE' then raise exception 'Active subscription required'; end if;
  if not exists (
    select 1 from public.companies c
    where c.id = p_tenant_id and c.activity_type = 'BOUTIQUE_COMMERCE' and c.deleted_at is null and c.owner_user_id = p_actor_user_id
    union all
    select 1 from public.commerce_employees e
    join public.commerce_employee_roles er on er.employee_id = e.id and er.tenant_id = e.tenant_id
    join public.commerce_role_permissions rp on rp.role_id = er.role_id and rp.tenant_id = er.tenant_id
    where e.tenant_id = p_tenant_id and e.user_id = p_actor_user_id and e.status = 'ACTIVE' and e.must_change_password = false and rp.permission_key = 'catalog.manage'
  ) then raise exception 'Catalog management permission required'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) as item(value)
    where case when jsonb_typeof(item.value -> 'path') = 'array' then jsonb_array_length(item.value -> 'path') not between 1 and 8 else true end
  ) then raise exception 'Category path must have 1 to 8 levels'; end if;

  for v_row in
    select item.value from jsonb_array_elements(p_rows) with ordinality as item(value, ordinality)
    order by jsonb_array_length(item.value -> 'path'), item.ordinality
  loop
    v_path := v_row -> 'path';
    v_depth := jsonb_array_length(v_path);
    v_parent_id := null;
    v_sort_order := coalesce((v_row ->> 'sortOrder')::integer, 0);
    v_description := nullif(left(btrim(coalesce(v_row ->> 'description', '')), 500), '');
    v_color := coalesce(v_row ->> 'color', '#0f766e');
    v_icon_key := coalesce(v_row ->> 'iconKey', 'tag');
    if v_sort_order not between -100000 and 100000 or v_color !~ '^#[0-9A-Fa-f]{6}$' or v_icon_key !~ '^[a-z][a-z0-9_-]{0,39}$' then
      raise exception 'Invalid category metadata';
    end if;
    for v_position in 0..v_depth - 1 loop
      v_segment := btrim(v_path ->> v_position);
      if char_length(v_segment) not between 2 and 80 then raise exception 'Invalid category name'; end if;
      select c.id, c.status into v_category_id, v_status
      from public.commerce_categories c
      where c.tenant_id = p_tenant_id
        and ((v_parent_id is null and c.parent_id is null) or c.parent_id = v_parent_id)
        and lower(c.name) = lower(v_segment) and c.status = 'ACTIVE'
      limit 1;
      if v_category_id is null then
        insert into public.commerce_categories (tenant_id, parent_id, name, description, color, icon_key, sort_order, status, created_by, updated_by)
        values (
          p_tenant_id, v_parent_id, v_segment,
          case when v_position = v_depth - 1 then v_description else null end,
          case when v_position = v_depth - 1 then v_color else '#0f766e' end,
          case when v_position = v_depth - 1 then v_icon_key else 'tag' end,
          case when v_position = v_depth - 1 then v_sort_order else 0 end,
          'ACTIVE', p_actor_user_id, p_actor_user_id
        ) returning id into v_category_id;
        v_count := v_count + 1;
      elsif v_position = v_depth - 1 then
        update public.commerce_categories set description = v_description, color = v_color, icon_key = v_icon_key,
          sort_order = v_sort_order, updated_by = p_actor_user_id, updated_at = now()
        where id = v_category_id and tenant_id = p_tenant_id;
        get diagnostics v_affected = row_count;
        v_count := v_count + v_affected;
      end if;
      v_parent_id := v_category_id;
      v_category_id := null;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- Install triggers after all required tables/functions exist.
drop trigger if exists commerce_catalog_audit on public.commerce_categories;
create trigger commerce_catalog_audit after insert or update or delete on public.commerce_categories
for each row execute function private.audit_commerce_catalog_row();
drop trigger if exists commerce_products_audit on public.commerce_products;
create trigger commerce_products_audit after insert or update or delete on public.commerce_products
for each row execute function private.audit_commerce_catalog_row();
drop trigger if exists commerce_customers_audit on public.commerce_customers;
create trigger commerce_customers_audit after insert or update or delete on public.commerce_customers
for each row execute function private.audit_commerce_catalog_row();
drop trigger if exists commerce_suppliers_audit on public.commerce_suppliers;
create trigger commerce_suppliers_audit after insert or update or delete on public.commerce_suppliers
for each row execute function private.audit_commerce_catalog_row();
drop trigger if exists commerce_products_price_history on public.commerce_products;
create trigger commerce_products_price_history after insert or update of purchase_price_xof, weighted_avg_cost_xof, price_retail_xof, price_semi_wholesale_xof, price_wholesale_xof, tax_rate_basis_points on public.commerce_products
for each row execute function private.capture_commerce_product_price_history();
drop trigger if exists commerce_seed_walk_in_customer on public.companies;
create trigger commerce_seed_walk_in_customer after insert on public.companies
for each row execute function private.ensure_commerce_walk_in_customer();

-- Backfill the default walk-in customer for any Commerce tenant created before this Sprint 2 migration.
insert into public.commerce_customers (tenant_id, customer_code, customer_type, display_name, price_list, is_walk_in, created_by)
select c.id, 'COMPTOIR', 'INDIVIDUAL', 'Client comptoir', 'RETAIL', true, c.owner_user_id
from public.companies c
where c.activity_type = 'BOUTIQUE_COMMERCE' and c.deleted_at is null
on conflict do nothing;

-- Product photos are private. Only the server service role uploads and returns short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('commerce-product-images', 'commerce-product-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.commerce_categories enable row level security;
alter table public.commerce_products enable row level security;
alter table public.commerce_customers enable row level security;
alter table public.commerce_suppliers enable row level security;
alter table public.commerce_product_price_history enable row level security;
alter table public.commerce_request_limits enable row level security;

revoke all on public.commerce_categories, public.commerce_products, public.commerce_customers, public.commerce_suppliers,
  public.commerce_product_price_history, public.commerce_request_limits from anon, authenticated;
grant select, insert, update, delete on public.commerce_categories, public.commerce_products, public.commerce_customers, public.commerce_suppliers to service_role;
grant select, insert on public.commerce_product_price_history to service_role;
grant select, insert, update, delete on public.commerce_request_limits to service_role;
revoke all on function public.consume_commerce_rate_limit(text,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.consume_commerce_rate_limit(text,integer,timestamptz) to service_role;
revoke all on function public.merge_commerce_category(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.merge_commerce_category(uuid,uuid,uuid,uuid) to service_role;
revoke all on function public.import_commerce_categories(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.import_commerce_categories(uuid,uuid,jsonb) to service_role;
revoke all on function private.audit_commerce_catalog_row() from public, anon, authenticated;
revoke all on function private.capture_commerce_product_price_history() from public, anon, authenticated;
revoke all on function private.ensure_commerce_walk_in_customer() from public, anon, authenticated;

commit;
