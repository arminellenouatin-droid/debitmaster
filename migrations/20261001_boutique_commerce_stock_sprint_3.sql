-- DebitMaster Boutique & Commerce - Sprint 3: stock, movements and reservations.
-- Additive and tenant-scoped. No legacy activity tables are changed.

create table if not exists public.commerce_stock_settings (
  tenant_id uuid primary key references public.companies(id) on delete restrict,
  allow_negative_stock boolean not null default false,
  reservation_duration_minutes integer not null default 1440
    check (reservation_duration_minutes between 60 and 10080),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.commerce_stock_settings (tenant_id)
select c.id
from public.companies c
where c.activity_type = 'BOUTIQUE_COMMERCE' and c.deleted_at is null
on conflict (tenant_id) do nothing;

create table if not exists public.commerce_stock_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  store_id uuid not null,
  product_id uuid not null,
  physical_quantity numeric(14,3) not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, product_id),
  unique (id, tenant_id),
  foreign key (store_id, tenant_id) references public.commerce_stores(id, tenant_id) on delete restrict,
  foreign key (product_id, tenant_id) references public.commerce_products(id, tenant_id) on delete restrict
);

create table if not exists public.commerce_stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  store_id uuid not null,
  product_id uuid not null,
  movement_type text not null check (movement_type in ('RECEIPT','ISSUE','ADJUSTMENT')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  quantity_before numeric(14,3) not null,
  quantity_after numeric(14,3) not null,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  reference_label text check (reference_label is null or char_length(reference_label) <= 200),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  foreign key (store_id, tenant_id) references public.commerce_stores(id, tenant_id) on delete restrict,
  foreign key (product_id, tenant_id) references public.commerce_products(id, tenant_id) on delete restrict,
  check (quantity_after = quantity_before + quantity_delta),
  check ((movement_type = 'RECEIPT' and quantity_delta > 0)
      or (movement_type = 'ISSUE' and quantity_delta < 0)
      or movement_type = 'ADJUSTMENT')
);
create index if not exists commerce_stock_movements_tenant_store_created_idx
  on public.commerce_stock_movements (tenant_id, store_id, created_at desc);
create index if not exists commerce_stock_movements_product_created_idx
  on public.commerce_stock_movements (tenant_id, product_id, created_at desc);

create table if not exists public.commerce_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete restrict,
  store_id uuid not null,
  product_id uuid not null,
  quantity numeric(14,3) not null check (quantity > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RELEASED','EXPIRED','CONSUMED')),
  reference_label text check (reference_label is null or char_length(reference_label) <= 200),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  released_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  foreign key (store_id, tenant_id) references public.commerce_stores(id, tenant_id) on delete restrict,
  foreign key (product_id, tenant_id) references public.commerce_products(id, tenant_id) on delete restrict
);
create index if not exists commerce_stock_reservations_active_idx
  on public.commerce_stock_reservations (tenant_id, store_id, product_id, expires_at)
  where status = 'ACTIVE';
create index if not exists commerce_stock_reservations_created_idx
  on public.commerce_stock_reservations (tenant_id, store_id, created_at desc);

create or replace function private.commerce_stock_actor_has_permission(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_tenant_id
      and c.activity_type = 'BOUTIQUE_COMMERCE'
      and c.deleted_at is null
      and c.owner_user_id = p_actor_user_id
  ) or exists (
    select 1
    from public.commerce_employees e
    join public.commerce_employee_roles er on er.employee_id = e.id and er.tenant_id = e.tenant_id
    join public.commerce_roles r on r.id = er.role_id and r.tenant_id = er.tenant_id and r.is_active
    join public.commerce_role_permissions rp on rp.role_id = r.id and rp.tenant_id = r.tenant_id
    where e.tenant_id = p_tenant_id
      and e.user_id = p_actor_user_id
      and e.status = 'ACTIVE'
      and e.must_change_password = false
      and rp.permission_key = p_permission_key
  );
$$;

create or replace function private.commerce_stock_actor_can_access_store(
  p_tenant_id uuid,
  p_store_id uuid,
  p_actor_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_tenant_id
      and c.activity_type = 'BOUTIQUE_COMMERCE'
      and c.deleted_at is null
      and c.owner_user_id = p_actor_user_id
  ) or exists (
    select 1
    from public.commerce_employee_stores es
    join public.commerce_employees e on e.id = es.employee_id and e.tenant_id = es.tenant_id
    where es.tenant_id = p_tenant_id
      and es.store_id = p_store_id
      and e.user_id = p_actor_user_id
      and e.status = 'ACTIVE'
      and e.must_change_password = false
  );
$$;

create or replace function public.expire_commerce_stock_reservations(
  p_tenant_id uuid,
  p_store_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not exists (
    select 1 from public.companies c
    where c.id = p_tenant_id and c.activity_type = 'BOUTIQUE_COMMERCE' and c.deleted_at is null
  ) then
    raise exception 'commerce_tenant_not_found' using errcode = '22023';
  end if;
  if p_store_id is not null and not exists (
    select 1 from public.commerce_stores s where s.id = p_store_id and s.tenant_id = p_tenant_id
  ) then
    raise exception 'commerce_store_not_found' using errcode = '22023';
  end if;

  with expired as (
    update public.commerce_stock_reservations r
    set status = 'EXPIRED', updated_at = now()
    where r.tenant_id = p_tenant_id
      and (p_store_id is null or r.store_id = p_store_id)
      and r.status = 'ACTIVE'
      and r.expires_at <= now()
    returning r.tenant_id, r.id, r.store_id, r.product_id, r.quantity
  )
  insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  select e.tenant_id, null, 'STOCK_RESERVATION_EXPIRED', 'STOCK_RESERVATION', e.id::text,
    jsonb_build_object('store_id', e.store_id, 'product_id', e.product_id, 'quantity', e.quantity)
  from expired e;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.record_commerce_stock_movement(
  p_tenant_id uuid,
  p_store_id uuid,
  p_product_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reason text,
  p_reference_label text,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permission text;
  v_product_status text;
  v_store_status text;
  v_allow_negative boolean := false;
  v_delta numeric(14,3);
  v_before numeric(14,3);
  v_after numeric(14,3);
  v_reserved numeric(14,3);
  v_existing public.commerce_stock_movements%rowtype;
  v_movement_id uuid;
begin
  if p_movement_type not in ('RECEIPT','ISSUE','ADJUSTMENT')
     or p_quantity is null or p_quantity = 0
     or char_length(trim(coalesce(p_reason, ''))) not between 3 and 500
     or char_length(coalesce(p_reference_label, '')) > 200
     or char_length(coalesce(p_idempotency_key, '')) not between 8 and 128 then
    raise exception 'invalid_stock_movement' using errcode = '22023';
  end if;
  if p_movement_type in ('RECEIPT','ISSUE') and p_quantity < 0 then
    raise exception 'invalid_stock_quantity' using errcode = '22023';
  end if;

  v_permission := case p_movement_type
    when 'RECEIPT' then 'stock.receive'
    when 'ISSUE' then 'stock.issue'
    else 'stock.manage'
  end;
  if not private.commerce_stock_actor_has_permission(p_tenant_id, p_actor_user_id, v_permission)
     or not private.commerce_stock_actor_can_access_store(p_tenant_id, p_store_id, p_actor_user_id) then
    raise exception 'commerce_stock_forbidden' using errcode = '42501';
  end if;
  if private.commerce_subscription_mode(p_tenant_id) <> 'ACTIVE' then
    raise exception 'commerce_stock_read_only' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.commerce_stores s
    where s.id = p_store_id and s.tenant_id = p_tenant_id and s.status = 'ACTIVE'
  ) then
    raise exception 'commerce_store_not_active' using errcode = '22023';
  end if;
  select p.status into v_product_status
  from public.commerce_products p
  where p.id = p_product_id and p.tenant_id = p_tenant_id;
  if not found or (v_product_status <> 'ACTIVE' and p_movement_type = 'RECEIPT') then
    raise exception 'commerce_product_not_available' using errcode = '22023';
  end if;

  v_delta := case p_movement_type
    when 'RECEIPT' then p_quantity
    when 'ISSUE' then -p_quantity
    else p_quantity
  end;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_idempotency_key, 0));
  select * into v_existing
  from public.commerce_stock_movements m
  where m.tenant_id = p_tenant_id and m.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.store_id <> p_store_id or v_existing.product_id <> p_product_id
       or v_existing.movement_type <> p_movement_type or v_existing.quantity_delta <> v_delta
       or v_existing.reason <> trim(p_reason)
       or coalesce(v_existing.reference_label, '') <> coalesce(nullif(trim(coalesce(p_reference_label, '')), ''), '') then
      raise exception 'stock_idempotency_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_existing.id, 'movementType', v_existing.movement_type,
      'quantityDelta', v_existing.quantity_delta, 'quantityBefore', v_existing.quantity_before,
      'quantityAfter', v_existing.quantity_after, 'idempotent', true);
  end if;

  perform public.expire_commerce_stock_reservations(p_tenant_id, p_store_id);
  insert into public.commerce_stock_balances (tenant_id, store_id, product_id)
  values (p_tenant_id, p_store_id, p_product_id)
  on conflict (tenant_id, store_id, product_id) do nothing;
  select b.physical_quantity into v_before
  from public.commerce_stock_balances b
  where b.tenant_id = p_tenant_id and b.store_id = p_store_id and b.product_id = p_product_id
  for update;
  select coalesce(sum(r.quantity), 0)::numeric(14,3) into v_reserved
  from public.commerce_stock_reservations r
  where r.tenant_id = p_tenant_id and r.store_id = p_store_id and r.product_id = p_product_id
    and r.status = 'ACTIVE' and r.expires_at > now();
  insert into public.commerce_stock_settings (tenant_id)
  values (p_tenant_id)
  on conflict (tenant_id) do nothing;
  select s.allow_negative_stock into v_allow_negative
  from public.commerce_stock_settings s where s.tenant_id = p_tenant_id
  for share;
  v_after := v_before + v_delta;
  if v_reserved > 0 and v_after < v_reserved then
    raise exception 'stock_reserved_quantity' using errcode = '23514';
  end if;
  if v_after < 0 and not coalesce(v_allow_negative, false) then
    raise exception 'stock_insufficient' using errcode = '23514';
  end if;

  update public.commerce_stock_balances b
  set physical_quantity = v_after, updated_by = p_actor_user_id, updated_at = now()
  where b.tenant_id = p_tenant_id and b.store_id = p_store_id and b.product_id = p_product_id;
  insert into public.commerce_stock_movements (
    tenant_id, store_id, product_id, movement_type, quantity_delta,
    quantity_before, quantity_after, reason, reference_label, idempotency_key, actor_user_id
  ) values (
    p_tenant_id, p_store_id, p_product_id, p_movement_type, v_delta,
    v_before, v_after, trim(p_reason), nullif(trim(coalesce(p_reference_label, '')), ''), p_idempotency_key, p_actor_user_id
  ) returning id into v_movement_id;

  insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, p_actor_user_id, 'STOCK_MOVEMENT_RECORDED', 'STOCK_MOVEMENT', v_movement_id::text,
    jsonb_build_object('store_id', p_store_id, 'product_id', p_product_id, 'movement_type', p_movement_type,
      'quantity_delta', v_delta, 'quantity_before', v_before, 'quantity_after', v_after,
      'reason', trim(p_reason), 'reference_label', nullif(trim(coalesce(p_reference_label, '')), '')));
  return jsonb_build_object('id', v_movement_id, 'movementType', p_movement_type,
    'quantityDelta', v_delta, 'quantityBefore', v_before, 'quantityAfter', v_after, 'idempotent', false);
end;
$$;

create or replace function public.create_commerce_stock_reservation(
  p_tenant_id uuid,
  p_store_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reference_label text,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duration integer := 1440;
  v_product_status text;
  v_before numeric(14,3);
  v_reserved numeric(14,3);
  v_available numeric(14,3);
  v_existing public.commerce_stock_reservations%rowtype;
  v_reservation_id uuid;
  v_expires_at timestamptz;
begin
  if p_quantity is null or p_quantity <= 0
     or char_length(coalesce(p_reference_label, '')) > 200
     or char_length(coalesce(p_idempotency_key, '')) not between 8 and 128 then
    raise exception 'invalid_stock_reservation' using errcode = '22023';
  end if;
  if not (
       private.commerce_stock_actor_has_permission(p_tenant_id, p_actor_user_id, 'stock.manage')
       or private.commerce_stock_actor_has_permission(p_tenant_id, p_actor_user_id, 'sales.create')
     )
     or not private.commerce_stock_actor_can_access_store(p_tenant_id, p_store_id, p_actor_user_id) then
    raise exception 'commerce_stock_forbidden' using errcode = '42501';
  end if;
  if private.commerce_subscription_mode(p_tenant_id) <> 'ACTIVE' then
    raise exception 'commerce_stock_read_only' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.commerce_stores s
    where s.id = p_store_id and s.tenant_id = p_tenant_id and s.status = 'ACTIVE'
  ) then
    raise exception 'commerce_store_not_active' using errcode = '22023';
  end if;
  select p.status into v_product_status from public.commerce_products p
  where p.id = p_product_id and p.tenant_id = p_tenant_id;
  if not found or v_product_status <> 'ACTIVE' then
    raise exception 'commerce_product_not_available' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_idempotency_key, 0));
  select * into v_existing
  from public.commerce_stock_reservations r
  where r.tenant_id = p_tenant_id and r.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.store_id <> p_store_id or v_existing.product_id <> p_product_id
       or v_existing.quantity <> p_quantity
       or coalesce(v_existing.reference_label, '') <> coalesce(nullif(trim(p_reference_label), ''), '') then
      raise exception 'stock_idempotency_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
      'quantity', v_existing.quantity, 'expiresAt', v_existing.expires_at, 'idempotent', true);
  end if;

  perform public.expire_commerce_stock_reservations(p_tenant_id, p_store_id);
  insert into public.commerce_stock_balances (tenant_id, store_id, product_id)
  values (p_tenant_id, p_store_id, p_product_id)
  on conflict (tenant_id, store_id, product_id) do nothing;
  select b.physical_quantity into v_before
  from public.commerce_stock_balances b
  where b.tenant_id = p_tenant_id and b.store_id = p_store_id and b.product_id = p_product_id
  for update;
  select coalesce(sum(r.quantity), 0)::numeric(14,3) into v_reserved
  from public.commerce_stock_reservations r
  where r.tenant_id = p_tenant_id and r.store_id = p_store_id and r.product_id = p_product_id
    and r.status = 'ACTIVE' and r.expires_at > now();
  v_available := v_before - v_reserved;
  if p_quantity > v_available then
    raise exception 'stock_insufficient' using errcode = '23514';
  end if;
  insert into public.commerce_stock_settings (tenant_id)
  values (p_tenant_id)
  on conflict (tenant_id) do nothing;
  select s.reservation_duration_minutes into v_duration
  from public.commerce_stock_settings s where s.tenant_id = p_tenant_id
  for share;
  v_expires_at := now() + make_interval(mins => coalesce(v_duration, 1440));
  insert into public.commerce_stock_reservations (
    tenant_id, store_id, product_id, quantity, reference_label, idempotency_key, expires_at, created_by
  ) values (
    p_tenant_id, p_store_id, p_product_id, p_quantity,
    nullif(trim(coalesce(p_reference_label, '')), ''), p_idempotency_key, v_expires_at, p_actor_user_id
  ) returning id into v_reservation_id;
  insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, p_actor_user_id, 'STOCK_RESERVED', 'STOCK_RESERVATION', v_reservation_id::text,
    jsonb_build_object('store_id', p_store_id, 'product_id', p_product_id, 'quantity', p_quantity,
      'reference_label', nullif(trim(coalesce(p_reference_label, '')), ''), 'expires_at', v_expires_at));
  return jsonb_build_object('id', v_reservation_id, 'status', 'ACTIVE', 'quantity', p_quantity,
    'expiresAt', v_expires_at, 'idempotent', false);
end;
$$;

create or replace function public.release_commerce_stock_reservation(
  p_tenant_id uuid,
  p_reservation_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.commerce_stock_reservations%rowtype;
begin
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 300 then
    raise exception 'invalid_stock_release_reason' using errcode = '22023';
  end if;
  select * into v_reservation
  from public.commerce_stock_reservations r
  where r.id = p_reservation_id and r.tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'stock_reservation_not_found' using errcode = 'P0002';
  end if;
  if not private.commerce_stock_actor_has_permission(p_tenant_id, p_actor_user_id, 'stock.manage')
     or not private.commerce_stock_actor_can_access_store(p_tenant_id, v_reservation.store_id, p_actor_user_id) then
    raise exception 'commerce_stock_forbidden' using errcode = '42501';
  end if;
  if private.commerce_subscription_mode(p_tenant_id) <> 'ACTIVE' then
    raise exception 'commerce_stock_read_only' using errcode = '42501';
  end if;
  if v_reservation.status = 'ACTIVE' and v_reservation.expires_at <= now() then
    update public.commerce_stock_reservations r
    set status = 'EXPIRED', updated_at = now()
    where r.id = p_reservation_id and r.tenant_id = p_tenant_id;
    insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (p_tenant_id, null, 'STOCK_RESERVATION_EXPIRED', 'STOCK_RESERVATION', p_reservation_id::text,
      jsonb_build_object('store_id', v_reservation.store_id, 'product_id', v_reservation.product_id, 'quantity', v_reservation.quantity));
    return jsonb_build_object('id', p_reservation_id, 'status', 'EXPIRED', 'idempotent', true);
  end if;
  if v_reservation.status in ('RELEASED','EXPIRED') then
    return jsonb_build_object('id', p_reservation_id, 'status', v_reservation.status, 'idempotent', true);
  end if;
  if v_reservation.status <> 'ACTIVE' then
    raise exception 'stock_reservation_not_releasable' using errcode = '23514';
  end if;
  update public.commerce_stock_reservations r
  set status = 'RELEASED', released_by = p_actor_user_id, updated_at = now()
  where r.id = p_reservation_id and r.tenant_id = p_tenant_id;
  insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, p_actor_user_id, 'STOCK_RESERVATION_RELEASED', 'STOCK_RESERVATION', p_reservation_id::text,
    jsonb_build_object('store_id', v_reservation.store_id, 'product_id', v_reservation.product_id,
      'quantity', v_reservation.quantity, 'reason', trim(p_reason)));
  return jsonb_build_object('id', p_reservation_id, 'status', 'RELEASED', 'idempotent', false);
end;
$$;

create or replace function public.update_commerce_stock_settings(
  p_tenant_id uuid,
  p_allow_negative_stock boolean,
  p_reservation_duration_minutes integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.commerce_stock_settings%rowtype;
begin
  if p_allow_negative_stock is null or p_reservation_duration_minutes not between 60 and 10080 then
    raise exception 'invalid_stock_settings' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.companies c where c.id = p_tenant_id and c.owner_user_id = p_actor_user_id
      and c.activity_type = 'BOUTIQUE_COMMERCE' and c.deleted_at is null
  ) then
    raise exception 'commerce_stock_owner_required' using errcode = '42501';
  end if;
  if private.commerce_subscription_mode(p_tenant_id) <> 'ACTIVE' then
    raise exception 'commerce_stock_read_only' using errcode = '42501';
  end if;
  perform public.expire_commerce_stock_reservations(p_tenant_id, null);
  insert into public.commerce_stock_settings (tenant_id)
  values (p_tenant_id)
  on conflict (tenant_id) do nothing;
  select * into v_before from public.commerce_stock_settings s where s.tenant_id = p_tenant_id for update;
  insert into public.commerce_stock_settings (tenant_id, allow_negative_stock, reservation_duration_minutes, updated_by, updated_at)
  values (p_tenant_id, p_allow_negative_stock, p_reservation_duration_minutes, p_actor_user_id, now())
  on conflict (tenant_id) do update set allow_negative_stock = excluded.allow_negative_stock,
    reservation_duration_minutes = excluded.reservation_duration_minutes,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.commerce_audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, p_actor_user_id, 'STOCK_SETTINGS_UPDATED', 'STOCK_SETTINGS', p_tenant_id::text,
    jsonb_build_object('before', jsonb_build_object(
      'allow_negative_stock', coalesce(v_before.allow_negative_stock, false),
      'reservation_duration_minutes', coalesce(v_before.reservation_duration_minutes, 1440)),
      'after', jsonb_build_object('allow_negative_stock', p_allow_negative_stock,
      'reservation_duration_minutes', p_reservation_duration_minutes)));
  return jsonb_build_object('allowNegativeStock', p_allow_negative_stock,
    'reservationDurationMinutes', p_reservation_duration_minutes);
end;
$$;

create or replace function private.prevent_commerce_stock_movement_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'COMMERCE_STOCK_MOVEMENTS_IMMUTABLE';
end;
$$;
drop trigger if exists commerce_stock_movements_immutable on public.commerce_stock_movements;
create trigger commerce_stock_movements_immutable
before update or delete on public.commerce_stock_movements
for each row execute function private.prevent_commerce_stock_movement_mutation();

create or replace view public.commerce_stock_levels as
select
  s.tenant_id,
  s.id as store_id,
  s.name as store_name,
  p.id as product_id,
  p.name as product_name,
  p.internal_code,
  p.barcode,
  p.base_unit,
  p.status as product_status,
  p.min_stock,
  p.max_stock,
  p.reorder_point,
  coalesce(b.physical_quantity, 0)::numeric(14,3) as physical_quantity,
  coalesce(res.reserved_quantity, 0)::numeric(14,3) as reserved_quantity,
  (coalesce(b.physical_quantity, 0) - coalesce(res.reserved_quantity, 0))::numeric(14,3) as available_quantity,
  case
    when coalesce(b.physical_quantity, 0) - coalesce(res.reserved_quantity, 0) <= 0 then 'OUT_OF_STOCK'
    when coalesce(b.physical_quantity, 0) - coalesce(res.reserved_quantity, 0) <= greatest(p.min_stock, p.reorder_point) then 'LOW_STOCK'
    when p.max_stock is not null and coalesce(b.physical_quantity, 0) > p.max_stock then 'OVERSTOCK'
    else 'HEALTHY'
  end as alert_status
from public.commerce_stores s
join public.commerce_products p on p.tenant_id = s.tenant_id
left join public.commerce_stock_balances b
  on b.tenant_id = s.tenant_id and b.store_id = s.id and b.product_id = p.id
left join lateral (
  select coalesce(sum(r.quantity), 0)::numeric(14,3) as reserved_quantity
  from public.commerce_stock_reservations r
  where r.tenant_id = s.tenant_id and r.store_id = s.id and r.product_id = p.id
    and r.status = 'ACTIVE' and r.expires_at > now()
) res on true
where s.status = 'ACTIVE';

alter table public.commerce_stock_settings enable row level security;
alter table public.commerce_stock_balances enable row level security;
alter table public.commerce_stock_movements enable row level security;
alter table public.commerce_stock_reservations enable row level security;

revoke all on public.commerce_stock_settings, public.commerce_stock_balances,
  public.commerce_stock_movements, public.commerce_stock_reservations, public.commerce_stock_levels
  from public, anon, authenticated;
grant select on public.commerce_stock_settings, public.commerce_stock_balances,
  public.commerce_stock_movements, public.commerce_stock_reservations, public.commerce_stock_levels
  to service_role;

revoke all on function private.commerce_stock_actor_has_permission(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.commerce_stock_actor_can_access_store(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.expire_commerce_stock_reservations(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_commerce_stock_movement(uuid, uuid, uuid, text, numeric, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_commerce_stock_reservation(uuid, uuid, uuid, numeric, text, text, uuid) from public, anon, authenticated;
revoke all on function public.release_commerce_stock_reservation(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.update_commerce_stock_settings(uuid, boolean, integer, uuid) from public, anon, authenticated;
grant execute on function public.expire_commerce_stock_reservations(uuid, uuid) to service_role;
grant execute on function public.record_commerce_stock_movement(uuid, uuid, uuid, text, numeric, text, text, text, uuid) to service_role;
grant execute on function public.create_commerce_stock_reservation(uuid, uuid, uuid, numeric, text, text, uuid) to service_role;
grant execute on function public.release_commerce_stock_reservation(uuid, uuid, uuid, text) to service_role;
grant execute on function public.update_commerce_stock_settings(uuid, boolean, integer, uuid) to service_role;
