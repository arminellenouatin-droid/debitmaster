-- DebitManager: correctif de traçabilité du destinataire et du réceptionnaire des transferts.
begin;

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
  select coalesce((select e.user_id from public.employees e where e.tenant_id = p_tenant_id and e.position = 'GERANT' and e.status = 'ACTIVE' and e.deleted_at is null order by e.created_at limit 1), c.owner_user_id) into recipient from public.companies c where c.id = p_tenant_id and c.deleted_at is null;
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
    values (transfer_row.tenant_id, item.product_id, 'OUT_TRANSFER', -item.quantity, 'Transfert reçu par le Gérant', auth.uid(), transfer_row.source_store_id, transfer_row.id);
    insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reason, responsible_user_id, store_id, transfer_id)
    values (transfer_row.tenant_id, item.product_id, 'IN_TRANSFER', item.quantity, 'Réception Magasin comptoir', auth.uid(), transfer_row.destination_store_id, transfer_row.id);
  end loop;
  update public.store_transfers set status = 'RECEIVED', received_at = now(), received_by = auth.uid(), updated_at = now() where id = transfer_row.id returning * into transfer_row;
  return transfer_row;
end;
$$;

grant execute on function public.receive_store_transfer(uuid) to authenticated;

commit;
