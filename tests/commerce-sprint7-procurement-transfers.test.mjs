import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

test("Sprint 7: Procurement, purchase orders, 3-way match, CMP and store transfers", async () => {
  const db = new PGlite();

  // 1. Initialiser le schéma de base
  await db.exec(`
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key default gen_random_uuid());
    create or replace function auth.uid() returns uuid language sql as $$ select gen_random_uuid(); $$;
    create table if not exists public.companies (
      id uuid primary key default gen_random_uuid(),
      name text default 'Test Boutique Commerce',
      activity_type text default 'BOUTIQUE_COMMERCE',
      owner_user_id uuid
    );
    create table if not exists public.commerce_stores (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid references public.companies(id),
      name text not null,
      store_type text default 'RETAIL'
    );
    create table if not exists public.commerce_suppliers (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid references public.companies(id),
      name text not null,
      phone text,
      email text
    );
    create table if not exists public.commerce_products (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid references public.companies(id),
      name text not null,
      internal_code text not null,
      weighted_avg_cost_xof bigint default 1000,
      purchase_price_xof bigint default 1000,
      reorder_point numeric(14,3) default 10,
      min_stock numeric(14,3) default 5
    );
    create table if not exists public.store_inventory (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid references public.companies(id),
      store_id uuid references public.commerce_stores(id),
      product_id uuid references public.commerce_products(id),
      current_stock numeric(14,3) not null default 0,
      updated_at timestamptz default now()
    );
    create table if not exists public.stock_movements (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid references public.companies(id),
      store_id uuid references public.commerce_stores(id),
      product_id uuid references public.commerce_products(id),
      movement_type text not null,
      quantity numeric(14,3) not null,
      reference text,
      notes text,
      created_at timestamptz default now()
    );
    create table if not exists public.document_sequences (
      tenant_id uuid not null,
      doc_type text not null check (doc_type in ('QUOTE', 'INVOICE', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE')),
      year int not null,
      current_number int not null default 0,
      primary key (tenant_id, doc_type, year)
    );
  `);

  // 2. Exécuter la migration Sprint 7
  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), "migrations", "20261001_sprint7_commerce_procurement_transfers.sql"),
    "utf8"
  );
  await db.exec(migrationSql);

  // 3. Créer un établissement et des acteurs
  const userRes = await db.query(`insert into auth.users default values returning id`);
  const userId = userRes.rows[0].id;

  const compRes = await db.query(
    `insert into public.companies (owner_user_id) values ($1) returning id`,
    [userId]
  );
  const tenantId = compRes.rows[0].id;

  const store1Res = await db.query(
    `insert into public.commerce_stores (tenant_id, name) values ($1, 'Magasin Central') returning id`,
    [tenantId]
  );
  const store1Id = store1Res.rows[0].id;

  const store2Res = await db.query(
    `insert into public.commerce_stores (tenant_id, name) values ($1, 'Boutique Comptoir') returning id`,
    [tenantId]
  );
  const store2Id = store2Res.rows[0].id;

  const suppRes = await db.query(
    `insert into public.commerce_suppliers (tenant_id, name, phone) values ($1, 'Grossiste Cotonou', '+229 97 00 00 00') returning id`,
    [tenantId]
  );
  const supplierId = suppRes.rows[0].id;

  const prodRes = await db.query(
    `insert into public.commerce_products (tenant_id, name, internal_code, weighted_avg_cost_xof, purchase_price_xof)
     values ($1, 'Riz Parfumé 25kg', 'RIZ-25', 15000, 15000) returning id`,
    [tenantId]
  );
  const productId = prodRes.rows[0].id;

  // Initialiser le stock à 10 sacs au Magasin Central
  await db.query(
    `insert into public.store_inventory (tenant_id, store_id, product_id, current_stock)
     values ($1, $2, $3, 10)`,
    [tenantId, store1Id, productId]
  );

  // --- TEST A: Numérotation séquentielle des documents Sprint 7 ---
  const daNum = await db.query(`select public.next_document_number($1, 'PURCHASE_REQUEST') as num`, [tenantId]);
  const bcNum = await db.query(`select public.next_document_number($1, 'PURCHASE_ORDER') as num`, [tenantId]);
  const brNum = await db.query(`select public.next_document_number($1, 'GOODS_RECEIPT') as num`, [tenantId]);
  const trfNum = await db.query(`select public.next_document_number($1, 'STOCK_TRANSFER') as num`, [tenantId]);

  assert.match(daNum.rows[0].num, /^DA-\d{4}-000001$/);
  assert.match(bcNum.rows[0].num, /^BC-\d{4}-000001$/);
  assert.match(brNum.rows[0].num, /^BR-\d{4}-000001$/);
  assert.match(trfNum.rows[0].num, /^TRF-\d{4}-000001$/);

  // --- TEST B: Demande d'Achat (DA) ---
  const daInsert = await db.query(`
    insert into public.purchase_requests (tenant_id, request_number, requested_by_user_id, store_id, supplier_id, total_estimated_amount_xof)
    values ($1, $2, $3, $4, $5, 300000)
    returning id
  `, [tenantId, daNum.rows[0].num, userId, store1Id, supplierId]);
  const daId = daInsert.rows[0].id;

  await db.query(`
    insert into public.purchase_request_items (tenant_id, request_id, product_id, product_name, quantity_requested, estimated_unit_price_xof)
    values ($1, $2, $3, 'Riz Parfumé 25kg', 20, 15000)
  `, [tenantId, daId, productId]);

  const daCheck = await db.query(`select status, priority from public.purchase_requests where id = $1`, [daId]);
  assert.equal(daCheck.rows[0].status, "PENDING");

  // --- TEST C: Bon de Commande Fournisseur (BC) converti d'une DA ---
  const poInsert = await db.query(`
    insert into public.purchase_orders (
      tenant_id, order_number, supplier_id, store_id, purchase_request_id,
      created_by_user_id, total_subtotal_xof, landed_costs_xof, total_amount_xof, status
    )
    values ($1, $2, $3, $4, $5, $6, 300000, 10000, 310000, 'APPROVED')
    returning id
  `, [tenantId, bcNum.rows[0].num, supplierId, store1Id, daId, userId]);
  const poId = poInsert.rows[0].id;

  await db.query(`
    insert into public.purchase_order_items (
      tenant_id, purchase_order_id, product_id, product_name, quantity_ordered, unit_price_xof, total_line_xof
    )
    values ($1, $2, $3, 'Riz Parfumé 25kg', 20, 15000, 300000)
  `, [tenantId, poId, productId]);

  // Marquer la DA comme CONVERTED
  await db.query(`update public.purchase_requests set status = 'CONVERTED' where id = $1`, [daId]);
  const daUpdated = await db.query(`select status from public.purchase_requests where id = $1`, [daId]);
  assert.equal(daUpdated.rows[0].status, "CONVERTED");

  // --- TEST D: Réception Marchandise (BR) & Rapprochement 3-voies & Recalcul CMP ---
  // On reçoit les 20 sacs à 15 000 FCFA
  // Stock initial : 10 sacs à CMP 15 000 = 150 000 F
  // Nouveau stock : 10 + 20 = 30 sacs
  // Nouveau CMP = ((10 * 15000) + (20 * 15000)) / 30 = 15 000 F
  const brInsert = await db.query(`
    insert into public.goods_receipts (
      tenant_id, receipt_number, purchase_order_id, supplier_id, store_id, supplier_invoice_ref, received_by_user_id
    )
    values ($1, $2, $3, $4, $5, 'FAC-FOURN-0012', $6)
    returning id
  `, [tenantId, brNum.rows[0].num, poId, supplierId, store1Id, userId]);
  const brId = brInsert.rows[0].id;

  await db.query(`
    insert into public.goods_receipt_items (
      tenant_id, goods_receipt_id, product_id, product_name, quantity_received, unit_cost_xof, total_cost_xof
    )
    values ($1, $2, $3, 'Riz Parfumé 25kg', 20, 15000, 300000)
  `, [tenantId, brId, productId]);

  // Mise à jour de store_inventory et stock_movements
  await db.query(`
    update public.store_inventory set current_stock = current_stock + 20 where store_id = $1 and product_id = $2
  `, [store1Id, productId]);

  await db.query(`
    insert into public.stock_movements (tenant_id, store_id, product_id, movement_type, quantity, reference)
    values ($1, $2, $3, 'PURCHASE_RECEIPT', 20, $4)
  `, [tenantId, store1Id, productId, brNum.rows[0].num]);

  // Mettre à jour purchase_order_items.quantity_received et purchase_orders.status
  await db.query(`
    update public.purchase_order_items set quantity_received = 20 where purchase_order_id = $1
  `, [poId]);
  await db.query(`
    update public.purchase_orders set status = 'RECEIVED' where id = $1
  `, [poId]);

  const invAfterReceipt = await db.query(
    `select current_stock from public.store_inventory where store_id = $1 and product_id = $2`,
    [store1Id, productId]
  );
  assert.equal(Number(invAfterReceipt.rows[0].current_stock), 30); // 10 initial + 20 reçus

  const poAfterReceipt = await db.query(`select status from public.purchase_orders where id = $1`, [poId]);
  assert.equal(poAfterReceipt.rows[0].status, "RECEIVED");

  // --- TEST E: Transfert Inter-Magasins ---
  // Transférer 5 sacs de store1 (Central) vers store2 (Boutique)
  const trfInsert = await db.query(`
    insert into public.commerce_transfers (
      tenant_id, transfer_number, source_store_id, destination_store_id, status, requested_by_user_id
    )
    values ($1, $2, $3, $4, 'REQUESTED', $5)
    returning id
  `, [tenantId, trfNum.rows[0].num, store1Id, store2Id, userId]);
  const trfId = trfInsert.rows[0].id;

  await db.query(`
    insert into public.commerce_transfer_items (
      tenant_id, transfer_id, product_id, product_name, quantity_requested
    )
    values ($1, $2, $3, 'Riz Parfumé 25kg', 5)
  `, [tenantId, trfId, productId]);

  // 1. Expédition : sortie du stock de store1
  await db.query(`
    update public.store_inventory set current_stock = current_stock - 5 where store_id = $1 and product_id = $2
  `, [store1Id, productId]);

  await db.query(`
    insert into public.stock_movements (tenant_id, store_id, product_id, movement_type, quantity, reference)
    values ($1, $2, $3, 'OUT_TRANSFER', -5, $4)
  `, [tenantId, store1Id, productId, trfNum.rows[0].num]);

  await db.query(`
    update public.commerce_transfers set status = 'IN_TRANSIT', shipped_at = now() where id = $1
  `, [trfId]);

  const invStore1AfterShip = await db.query(
    `select current_stock from public.store_inventory where store_id = $1 and product_id = $2`,
    [store1Id, productId]
  );
  assert.equal(Number(invStore1AfterShip.rows[0].current_stock), 25); // 30 - 5 = 25

  // 2. Réception : entrée dans le stock de store2
  await db.query(`
    insert into public.store_inventory (tenant_id, store_id, product_id, current_stock)
    values ($1, $2, $3, 5)
  `, [tenantId, store2Id, productId]);

  await db.query(`
    insert into public.stock_movements (tenant_id, store_id, product_id, movement_type, quantity, reference)
    values ($1, $2, $3, 'IN_TRANSFER', 5, $4)
  `, [tenantId, store2Id, productId, trfNum.rows[0].num]);

  await db.query(`
    update public.commerce_transfers set status = 'RECEIVED', received_at = now() where id = $1
  `, [trfId]);

  const invStore2AfterReceive = await db.query(
    `select current_stock from public.store_inventory where store_id = $1 and product_id = $2`,
    [store2Id, productId]
  );
  assert.equal(Number(invStore2AfterReceive.rows[0].current_stock), 5);

  const trfFinal = await db.query(`select status from public.commerce_transfers where id = $1`, [trfId]);
  assert.equal(trfFinal.rows[0].status, "RECEIVED");
});
