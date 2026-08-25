-- DebitManager: the counter-store label is technical, while the display name stays free.
-- Existing stores named "Magasin comptoir" are preserved and upgraded to the counter type.
begin;

update public.inventory_stores
set store_type = 'COUNTER', updated_at = now()
where is_active
  and lower(trim(name)) = lower('Magasin comptoir')
  and store_type <> 'COUNTER';

create unique index if not exists inventory_stores_one_counter_per_tenant_idx
  on public.inventory_stores (tenant_id)
  where is_active and store_type = 'COUNTER';

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
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id, 'stock.handoff') then
    raise exception 'STOCK_HANDOFF_FORBIDDEN';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_TRANSFER_QUANTITY';
  end if;

  select * into source_store
  from public.inventory_stores
  where id = p_source_store_id and tenant_id = p_tenant_id and is_active
  for update;
  select * into destination_store
  from public.inventory_stores
  where id = p_destination_store_id and tenant_id = p_tenant_id and is_active
  for update;

  if source_store.id is null or destination_store.id is null then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if source_store.store_type = 'COUNTER' then
    raise exception 'COUNTER_STORE_CANNOT_BE_SOURCE';
  end if;
  if destination_store.store_type <> 'COUNTER' then
    raise exception 'INVALID_COUNTER_DESTINATION';
  end if;

  select * into source_position
  from public.store_inventory
  where store_id = p_source_store_id
    and product_id = p_product_id
    and tenant_id = p_tenant_id
  for update;
  if source_position.id is null or source_position.quantity - source_position.reserved_quantity < p_quantity then
    raise exception 'INSUFFICIENT_AVAILABLE_STOCK';
  end if;

  select coalesce(
    (select e.user_id
     from public.employees e
     where e.tenant_id = p_tenant_id
       and e.position = 'GERANT'
       and e.status = 'ACTIVE'
       and e.deleted_at is null
     order by e.created_at
     limit 1),
    c.owner_user_id
  ) into recipient
  from public.companies c
  where c.id = p_tenant_id and c.deleted_at is null;

  insert into public.store_transfers
    (tenant_id, source_store_id, destination_store_id, sent_by, recipient_user_id, notes)
  values
    (p_tenant_id, p_source_store_id, p_destination_store_id, auth.uid(), recipient, nullif(left(coalesce(p_notes, ''), 240), ''))
  returning * into transfer_row;

  insert into public.store_transfer_items (transfer_id, tenant_id, product_id, quantity)
  values (transfer_row.id, p_tenant_id, p_product_id, p_quantity);

  update public.store_inventory
  set reserved_quantity = reserved_quantity + p_quantity, updated_at = now()
  where id = source_position.id;

  if recipient is not null then
    insert into public.internal_messages (tenant_id, sender_user_id, recipient_user_id, subject, body)
    values (p_tenant_id, auth.uid(), recipient, 'Nouvelle livraison à confirmer', 'Une livraison est en attente dans le magasin comptoir. Ouvrez vos notifications et confirmez « Reçu » après vérification.');
  end if;
  return transfer_row;
end;
$$;

grant execute on function public.create_store_transfer(uuid, uuid, uuid, uuid, integer, text) to authenticated;

commit;
