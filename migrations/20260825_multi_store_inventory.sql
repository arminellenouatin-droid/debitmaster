-- DebitManager: modèle multi-magasins validé par l'utilisateur.
-- Aucun stock source n'est débité avant la réception confirmée par le Gérant.
begin;

alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete restrict,
  add column if not exists deleted_at timestamptz;

create unique index if not exists categories_tenant_name_active_idx
  on public.categories (tenant_id, lower(name))
  where deleted_at is null;
create index if not exists categories_tenant_parent_idx
  on public.categories (tenant_id, parent_id)
  where deleted_at is null;

create table if not exists public.inventory_stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  name varchar(120) not null,
  store_type text not null default 'GENERAL' check (store_type in ('GENERAL', 'COUNTER')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists inventory_stores_tenant_name_active_idx
  on public.inventory_stores (tenant_id, lower(name))
  where is_active;
create index if not exists inventory_stores_tenant_idx on public.inventory_stores (tenant_id, is_active);

create table if not exists public.store_inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  store_id uuid not null references public.inventory_stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= quantity),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, product_id)
);
create index if not exists store_inventory_tenant_product_idx on public.store_inventory (tenant_id, product_id);
create index if not exists store_inventory_store_idx on public.store_inventory (store_id);

create table if not exists public.stock_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  store_id uuid not null references public.inventory_stores(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  invoice_number varchar(120),
  purchase_unit_price integer not null check (purchase_unit_price >= 0),
  quantity integer not null check (quantity > 0),
  purchased_at timestamptz not null default now(),
  entered_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists stock_purchases_tenant_product_date_idx on public.stock_purchases (tenant_id, product_id, purchased_at desc);

alter table public.stock_movements
  add column if not exists store_id uuid references public.inventory_stores(id) on delete set null,
  add column if not exists transfer_id uuid,
  add column if not exists purchase_id uuid references public.stock_purchases(id) on delete set null,
  add column if not exists purchase_unit_price integer;

alter table public.stock_movements drop constraint if exists stock_movements_movement_type_check;
alter table public.stock_movements add constraint stock_movements_movement_type_check
  check (movement_type in ('IN_PURCHASE', 'OUT_SALE', 'OUT_LOSS', 'OUT_BREAKAGE', 'OUT_EXPIRY', 'ADJUSTMENT', 'OUT_TRANSFER', 'IN_TRANSFER'));
create index if not exists stock_movements_store_idx on public.stock_movements (store_id, created_at desc);

create table if not exists public.store_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  source_store_id uuid not null references public.inventory_stores(id) on delete restrict,
  destination_store_id uuid not null references public.inventory_stores(id) on delete restrict,
  sent_by uuid not null references auth.users(id),
  recipient_user_id uuid references auth.users(id),
  status text not null default 'PENDING_RECEIPT' check (status in ('PENDING_RECEIPT', 'RECEIVED', 'CANCELLED')),
  notes varchar(240),
  sent_at timestamptz not null default now(),
  received_at timestamptz,
  received_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_transfers_tenant_status_idx on public.store_transfers (tenant_id, status, sent_at desc);

create table if not exists public.store_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.store_transfers(id) on delete cascade,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create index if not exists store_transfer_items_transfer_idx on public.store_transfer_items (transfer_id);

alter table public.categories enable row level security;
alter table public.inventory_stores enable row level security;
alter table public.store_inventory enable row level security;
alter table public.stock_purchases enable row level security;
alter table public.store_transfers enable row level security;
alter table public.store_transfer_items enable row level security;

-- Les catégories restent visibles dans le tenant et administrables par products.manage.
drop policy if exists categories_select_tenant on public.categories;
create policy categories_select_tenant on public.categories
  for select to authenticated
  using (tenant_id = private.current_tenant_id() or private.has_tenant_permission(tenant_id, 'products.manage'));
drop policy if exists categories_insert_manager on public.categories;
create policy categories_insert_manager on public.categories
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'products.manage'));
drop policy if exists categories_update_manager on public.categories;
create policy categories_update_manager on public.categories
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'products.manage'))
  with check (private.has_tenant_permission(tenant_id, 'products.manage'));
drop policy if exists categories_delete_manager on public.categories;
create policy categories_delete_manager on public.categories
  for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'products.manage'));

-- Le Magasinier gère les lieux physiques ; les positions et transferts sont modifiés par RPC sécurisées.
drop policy if exists inventory_stores_select_authorized on public.inventory_stores;
create policy inventory_stores_select_authorized on public.inventory_stores
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.view'));
drop policy if exists inventory_stores_insert_authorized on public.inventory_stores;
create policy inventory_stores_insert_authorized on public.inventory_stores
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'products.manage') and created_by = (select auth.uid()));
drop policy if exists inventory_stores_update_authorized on public.inventory_stores;
create policy inventory_stores_update_authorized on public.inventory_stores
  for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'products.manage'))
  with check (private.has_tenant_permission(tenant_id, 'products.manage'));
drop policy if exists inventory_stores_delete_authorized on public.inventory_stores;
create policy inventory_stores_delete_authorized on public.inventory_stores
  for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'products.manage'));

create policy store_inventory_select_authorized on public.store_inventory
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.view'));
create policy stock_purchases_select_authorized on public.stock_purchases
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.view'));
create policy stock_purchases_insert_authorized on public.stock_purchases
  for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'stock.receive') and entered_by = (select auth.uid()));

create policy store_transfers_select_authorized on public.store_transfers
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.view'));
create policy store_transfer_items_select_authorized on public.store_transfer_items
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'stock.view'));

create or replace function private.prevent_category_delete_with_stock()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if exists (
    select 1
    from public.products p
    join public.store_inventory si on si.product_id = p.id
    where p.category_id = old.id and si.quantity > 0
  ) then
    raise exception 'CATEGORY_HAS_STOCK';
  end if;
  return old;
end;
$$;
drop trigger if exists categories_block_delete_with_stock on public.categories;
create trigger categories_block_delete_with_stock
before delete on public.categories
for each row execute function private.prevent_category_delete_with_stock();

create or replace function private.prevent_category_archive_with_stock()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null and exists (
    select 1
    from public.products p
    join public.store_inventory si on si.product_id = p.id
    where p.category_id = old.id and si.quantity > 0
  ) then
    raise exception 'CATEGORY_HAS_STOCK';
  end if;
  return new;
end;
$$;
drop trigger if exists categories_block_archive_with_stock on public.categories;
create trigger categories_block_archive_with_stock
before update of deleted_at on public.categories
for each row execute function private.prevent_category_archive_with_stock();

create or replace function private.sync_product_total_stock()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare affected_product uuid;
begin
  affected_product := coalesce(new.product_id, old.product_id);
  update public.products p
  set current_stock = coalesce((select sum(si.quantity) from public.store_inventory si where si.product_id = affected_product), 0), updated_at = now()
  where p.id = affected_product;
  if tg_op = 'UPDATE' and old.product_id <> new.product_id then
    update public.products p
    set current_stock = coalesce((select sum(si.quantity) from public.store_inventory si where si.product_id = old.product_id), 0), updated_at = now()
    where p.id = old.product_id;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists store_inventory_sync_product_total on public.store_inventory;
create trigger store_inventory_sync_product_total
after insert or update or delete on public.store_inventory
for each row execute function private.sync_product_total_stock();

create or replace function public.create_store_transfer(
  p_tenant_id uuid,
  p_source_store_id uuid,
  p_destination_store_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_notes text default null
)
returns public.store_transfers
language plpgsql
security definer
set search_path = public, private
as $$
declare
  source_store public.inventory_stores;
  destination_store public.inventory_stores;
  source_position public.store_inventory;
  transfer_row public.store_transfers;
  recipient uuid;
begin
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id, 'stock.handoff') then raise exception 'STOCK_HANDOFF_FORBIDDEN'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_TRANSFER_QUANTITY'; end if;
  select * into source_store from public.inventory_stores where id = p_source_store_id and tenant_id = p_tenant_id and is_active for update;
  select * into destination_store from public.inventory_stores where id = p_destination_store_id and tenant_id = p_tenant_id and is_active for update;
  if source_store.id is null or destination_store.id is null then raise exception 'STORE_NOT_FOUND'; end if;
  if source_store.store_type = 'COUNTER' then raise exception 'COUNTER_STORE_CANNOT_BE_SOURCE'; end if;
  if destination_store.store_type <> 'COUNTER' or lower(destination_store.name) <> lower('Magasin comptoir') then raise exception 'INVALID_COUNTER_DESTINATION'; end if;
  select * into source_position from public.store_inventory where store_id = p_source_store_id and product_id = p_product_id and tenant_id = p_tenant_id for update;
  if source_position.id is null or source_position.quantity - source_position.reserved_quantity < p_quantity then raise exception 'INSUFFICIENT_AVAILABLE_STOCK'; end if;
  select coalesce((select e.user_id from public.employees e where e.tenant_id = p_tenant_id and e.role = 'GERANT' and e.status = 'ACTIVE' and e.deleted_at is null order by e.created_at limit 1), c.owner_user_id) into recipient from public.companies c where c.id = p_tenant_id and c.deleted_at is null;
  insert into public.store_transfers (tenant_id, source_store_id, destination_store_id, sent_by, recipient_user_id, notes) values (p_tenant_id, p_source_store_id, p_destination_store_id, auth.uid(), recipient, nullif(left(coalesce(p_notes, ''), 240), '')) returning * into transfer_row;
  insert into public.store_transfer_items (transfer_id, tenant_id, product_id, quantity) values (transfer_row.id, p_tenant_id, p_product_id, p_quantity);
  update public.store_inventory set reserved_quantity = reserved_quantity + p_quantity, updated_at = now() where id = source_position.id;
  if recipient is not null then
    insert into public.internal_messages (tenant_id, sender_user_id, recipient_user_id, subject, body)
    values (p_tenant_id, auth.uid(), recipient, 'Nouvelle livraison à confirmer', 'Une livraison est en attente dans le Magasin comptoir. Ouvrez vos notifications et confirmez « Reçu » après vérification.');
  end if;
  return transfer_row;
end;
$$;

grant execute on function public.create_store_transfer(uuid, uuid, uuid, uuid, integer, text) to authenticated;

create or replace function public.receive_store_transfer(p_transfer_id uuid)
returns public.store_transfers
language plpgsql
security definer
set search_path = public, private
as $$
declare
  transfer_row public.store_transfers;
  item record;
  source_position public.store_inventory;
  destination_position public.store_inventory;
begin
  select * into transfer_row from public.store_transfers where id = p_transfer_id for update;
  if transfer_row.id is null then raise exception 'TRANSFER_NOT_FOUND'; end if;
  if auth.uid() is null or not private.has_tenant_permission(transfer_row.tenant_id, 'stock.accept_counter') then raise exception 'STOCK_RECEIPT_FORBIDDEN'; end if;
  if transfer_row.status <> 'PENDING_RECEIPT' then raise exception 'TRANSFER_ALREADY_PROCESSED'; end if;
  for item in select * from public.store_transfer_items where transfer_id = transfer_row.id order by id loop
    select * into source_position from public.store_inventory where store_id = transfer_row.source_store_id and product_id = item.product_id and tenant_id = transfer_row.tenant_id for update;
    if source_position.id is null or source_position.reserved_quantity < item.quantity or source_position.quantity < item.quantity then raise exception 'SOURCE_STOCK_CHANGED'; end if;
    update public.store_inventory set quantity = quantity - item.quantity, reserved_quantity = reserved_quantity - item.quantity, updated_at = now() where id = source_position.id;
    insert into public.store_inventory (tenant_id, store_id, product_id, quantity, reserved_quantity) values (transfer_row.tenant_id, transfer_row.destination_store_id, item.product_id, item.quantity, 0)
    on conflict (store_id, product_id) do update set quantity = public.store_inventory.quantity + excluded.quantity, updated_at = now();
    insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reason, responsible_user_id, store_id, transfer_id)
    values (transfer_row.tenant_id, item.product_id, 'OUT_TRANSFER', -item.quantity, 'Transfert reçu par le Gérant', transfer_row.received_by, transfer_row.source_store_id, transfer_row.id);
    insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reason, responsible_user_id, store_id, transfer_id)
    values (transfer_row.tenant_id, item.product_id, 'IN_TRANSFER', item.quantity, 'Réception Magasin comptoir', auth.uid(), transfer_row.destination_store_id, transfer_row.id);
  end loop;
  update public.store_transfers set status = 'RECEIVED', received_at = now(), received_by = auth.uid(), updated_at = now() where id = transfer_row.id returning * into transfer_row;
  return transfer_row;
end;
$$;

grant execute on function public.receive_store_transfer(uuid) to authenticated;

create or replace function private.bootstrap_company_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.categories (tenant_id, name) values
    (new.id, 'Liqueurs'), (new.id, 'Bières'), (new.id, 'Sucreries'), (new.id, 'Repas')
  on conflict (tenant_id, lower(name)) where deleted_at is null do nothing;
  return new;
end;
$$;
drop trigger if exists companies_bootstrap_inventory on public.companies;
create trigger companies_bootstrap_inventory
after insert on public.companies
for each row execute function private.bootstrap_company_inventory();

do $$
declare company_row record;
begin
  for company_row in select id from public.companies where deleted_at is null loop
    insert into public.categories (tenant_id, name) values
      (company_row.id, 'Liqueurs'), (company_row.id, 'Bières'), (company_row.id, 'Sucreries'), (company_row.id, 'Repas')
    on conflict (tenant_id, lower(name)) where deleted_at is null do nothing;
  end loop;
end;
$$;

commit;
