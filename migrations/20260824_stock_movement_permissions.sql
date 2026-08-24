-- DebitManager: les mouvements de stock sont autorisés selon leur nature métier.
drop policy if exists stock_movements_insert_authorized on public.stock_movements;
create policy stock_movements_insert_authorized on public.stock_movements
  for insert to authenticated
  with check (
    (movement_type = 'IN_PURCHASE' and private.has_tenant_permission(tenant_id, 'stock.receive'))
    or (movement_type = 'OUT_SALE' and private.has_tenant_permission(tenant_id, 'stock.issue'))
    or (movement_type in ('OUT_LOSS', 'OUT_BREAKAGE', 'OUT_EXPIRY', 'ADJUSTMENT') and private.has_tenant_permission(tenant_id, 'stock.adjust'))
  );
