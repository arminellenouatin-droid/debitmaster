-- DebitManager: opérations atomiques complémentaires du modèle multi-magasins.
begin;

create or replace function public.record_stock_purchase(
  p_tenant_id uuid,
  p_store_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_purchase_unit_price integer,
  p_invoice_number text default null
)
returns public.stock_purchases
language plpgsql
security definer
set search_path = public, private
as $$
declare
  store_row public.inventory_stores;
  product_row public.products;
  purchase_row public.stock_purchases;
begin
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id, 'stock.receive') then raise exception 'STOCK_RECEIPT_FORBIDDEN'; end if;
  if p_quantity is null or p_quantity <= 0 or p_purchase_unit_price is null or p_purchase_unit_price < 0 then raise exception 'INVALID_PURCHASE'; end if;
  select * into store_row from public.inventory_stores where id = p_store_id and tenant_id = p_tenant_id and is_active for update;
  if store_row.id is null then raise exception 'STORE_NOT_FOUND'; end if;
  if store_row.store_type = 'COUNTER' then raise exception 'COUNTER_STORE_RECEIPT_FORBIDDEN'; end if;
  select * into product_row from public.products where id = p_product_id and tenant_id = p_tenant_id and deleted_at is null for update;
  if product_row.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  insert into public.stock_purchases (tenant_id, store_id, product_id, invoice_number, purchase_unit_price, quantity, entered_by)
  values (p_tenant_id, p_store_id, p_product_id, nullif(left(coalesce(p_invoice_number, ''), 120), ''), p_purchase_unit_price, p_quantity, auth.uid())
  returning * into purchase_row;
  insert into public.store_inventory (tenant_id, store_id, product_id, quantity, reserved_quantity)
  values (p_tenant_id, p_store_id, p_product_id, p_quantity, 0)
  on conflict (store_id, product_id) do update set quantity = public.store_inventory.quantity + excluded.quantity, updated_at = now();
  insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reason, responsible_user_id, store_id, purchase_id, purchase_unit_price)
  values (p_tenant_id, p_product_id, 'IN_PURCHASE', p_quantity, 'Entrée stock' || case when p_invoice_number is null or p_invoice_number = '' then '' else ' · facture ' || left(p_invoice_number, 120) end, auth.uid(), p_store_id, purchase_row.id, p_purchase_unit_price);
  return purchase_row;
end;
$$;

grant execute on function public.record_stock_purchase(uuid, uuid, uuid, integer, integer, text) to authenticated;

commit;
