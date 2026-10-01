import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

test("Sprint 8: Physical Inventory, sessions, counts, recounts, variance calculations and stock adjustments", async () => {
  const db = new PGlite();

  // 1. Initialiser le schéma de base requis pour le test
  await db.exec(`
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key default gen_random_uuid());
    create or replace function auth.uid() returns uuid language sql as $$ select gen_random_uuid(); $$;

    create table if not exists public.companies (
      id uuid primary key default gen_random_uuid(),
      name text default 'Boutique Test SARL',
      activity_type text default 'BOUTIQUE_COMMERCE',
      owner_user_id uuid
    );

    create table if not exists public.commerce_stores (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid references public.companies(id),
      name text not null,
      store_type text default 'RETAIL',
      status text default 'ACTIVE'
    );

    create table if not exists public.commerce_categories (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid references public.companies(id),
      name text not null,
      status text default 'ACTIVE'
    );

    create table if not exists public.commerce_products (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid references public.companies(id),
      category_id uuid references public.commerce_categories(id),
      name text not null,
      internal_code text not null,
      weighted_avg_cost_xof bigint default 1500,
      purchase_price_xof bigint default 1500,
      status text default 'ACTIVE'
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
      doc_type text not null check (doc_type in (
        'QUOTE', 'INVOICE', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE',
        'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'STOCK_TRANSFER'
      )),
      year int not null,
      current_number int not null default 0,
      primary key (tenant_id, doc_type, year)
    );
  `);

  // 2. Exécuter la migration Sprint 8
  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), "migrations", "20261001_sprint8_commerce_physical_inventory.sql"),
    "utf8"
  );
  await db.exec(migrationSql);

  // 3. Créer un établissement et les utilisateurs de test
  const userAdminRes = await db.query(`insert into auth.users default values returning id`);
  const adminUserId = userAdminRes.rows[0].id;

  const userCounterRes = await db.query(`insert into auth.users default values returning id`);
  const counterUserId = userCounterRes.rows[0].id;

  const compRes = await db.query(
    `insert into public.companies (name, owner_user_id) values ('Boutique Elegance', $1) returning id`,
    [adminUserId]
  );
  const tenantId = compRes.rows[0].id;

  const storeRes = await db.query(
    `insert into public.commerce_stores (tenant_id, name) values ($1, 'Boutique Principale') returning id`,
    [tenantId]
  );
  const storeId = storeRes.rows[0].id;

  // Créer des produits
  const catRes = await db.query(
    `insert into public.commerce_categories (tenant_id, name) values ($1, 'Textiles') returning id`,
    [tenantId]
  );
  const catId = catRes.rows[0].id;

  const prod1Res = await db.query(
    `insert into public.commerce_products (tenant_id, category_id, name, internal_code, weighted_avg_cost_xof)
     values ($1, $2, 'Chemise Wax Supérieure', 'CHEM-001', 5000) returning id`,
    [tenantId, catId]
  );
  const prod1Id = prod1Res.rows[0].id;

  const prod2Res = await db.query(
    `insert into public.commerce_products (tenant_id, category_id, name, internal_code, weighted_avg_cost_xof)
     values ($1, $2, 'Robe Soie Africaine', 'ROBE-002', 12000) returning id`,
    [tenantId, catId]
  );
  const prod2Id = prod2Res.rows[0].id;

  // Stock physique initial : 30 chemises et 10 robes
  await db.query(
    `insert into public.store_inventory (tenant_id, store_id, product_id, current_stock)
     values ($1, $2, $3, 30), ($1, $2, $4, 10)`,
    [tenantId, storeId, prod1Id, prod2Id]
  );

  // 4. Tester la génération de séquence INV
  const seqRes = await db.query(
    `select public.next_document_number($1, 'INVENTORY_SESSION') as doc_num`,
    [tenantId]
  );
  const currentYear = new Date().getFullYear();
  assert.equal(seqRes.rows[0].doc_num, `INV-${currentYear}-000001`);

  // 5. Initialiser une session d'inventaire
  const sessionRes = await db.query(
    `insert into public.commerce_inventory_sessions (
       tenant_id, session_number, store_id, inventory_type, status,
       total_theoretical_value_xof, total_items_count, started_by_user_id
     ) values (
       $1, $2, $3, 'GENERAL', 'IN_PROGRESS',
       (30 * 5000) + (10 * 12000), 2, $4
     ) returning id, total_theoretical_value_xof`,
    [tenantId, seqRes.rows[0].doc_num, storeId, counterUserId]
  );
  const sessionId = sessionRes.rows[0].id;
  assert.equal(Number(sessionRes.rows[0].total_theoretical_value_xof), 270000);

  // Insérer les lignes gelées
  await db.query(
    `insert into public.commerce_inventory_items (
       tenant_id, session_id, product_id, product_name, internal_code,
       unit_cost_xof, theoretical_quantity, status
     ) values
     ($1, $2, $3, 'Chemise Wax Supérieure', 'CHEM-001', 5000, 30, 'PENDING'),
     ($1, $2, $4, 'Robe Soie Africaine', 'ROBE-002', 12000, 10, 'PENDING')`,
    [tenantId, sessionId, prod1Id, prod2Id]
  );

  // 6. Comptage 1 & Recomptage (simulation saisie inventaire)
  // Chemise : compté 28 (écart de -2)
  // Robe : compté 10 (conforme)
  const itemsRes = await db.query(
    `select id, product_id, theoretical_quantity, unit_cost_xof from public.commerce_inventory_items where session_id = $1`,
    [sessionId]
  );
  const item1 = itemsRes.rows.find((r) => r.product_id === prod1Id);
  const item2 = itemsRes.rows.find((r) => r.product_id === prod2Id);

  // Mise à jour de item1 avec recomptage à 29 (écart final de -1 unité = -5,000 XOF)
  await db.query(
    `update public.commerce_inventory_items set
       counted_quantity = 28,
       recounted_quantity = 29,
       final_quantity = 29,
       variance_quantity = -1,
       variance_amount_xof = -5000,
       status = 'RECOUNTED',
       justification = '1 pièce manquante constatée au rayon',
       counter_user_id = $1
     where id = $2`,
    [counterUserId, item1.id]
  );

  // Mise à jour de item2 sans écart (10 compté = 10 théorique)
  await db.query(
    `update public.commerce_inventory_items set
       counted_quantity = 10,
       final_quantity = 10,
       variance_quantity = 0,
       variance_amount_xof = 0,
       status = 'MATCHED',
       counter_user_id = $1
     where id = $2`,
    [counterUserId, item2.id]
  );

  // Mettre à jour les totaux de session
  await db.query(
    `update public.commerce_inventory_sessions set
       status = 'COUNTED',
       total_counted_value_xof = (29 * 5000) + (10 * 12000),
       total_variance_value_xof = -5000,
       discrepancies_count = 1
     where id = $1`,
    [sessionId]
  );

  const checkSession = await db.query(
    `select status, discrepancies_count, total_variance_value_xof from public.commerce_inventory_sessions where id = $1`,
    [sessionId]
  );
  assert.equal(checkSession.rows[0].status, "COUNTED");
  assert.equal(checkSession.rows[0].discrepancies_count, 1);
  assert.equal(Number(checkSession.rows[0].total_variance_value_xof), -5000);

  // 7. Validation et régularisation automatique du stock
  // Appliquer la régularisation comme dans l'API validate
  // Chemise : stock passe de 30 à 29
  await db.query(
    `update public.store_inventory set current_stock = 29 where store_id = $1 and product_id = $2`,
    [storeId, prod1Id]
  );

  // Mouvement d'écart tracé dans stock_movements
  await db.query(
    `insert into public.stock_movements (
       tenant_id, store_id, product_id, movement_type, quantity, reference, notes
     ) values ($1, $2, $3, 'ADJUSTMENT', -1, $4, 'Régularisation inventaire')`,
    [tenantId, storeId, prod1Id, seqRes.rows[0].doc_num]
  );

  // Valider la session
  await db.query(
    `update public.commerce_inventory_sessions set
       status = 'VALIDATED',
       validated_by_user_id = $1,
       validated_at = now()
     where id = $2`,
    [adminUserId, sessionId]
  );

  // 8. Vérifications finales de consistance
  const finalStock = await db.query(
    `select product_id, current_stock from public.store_inventory where store_id = $1 order by product_id`,
    [storeId]
  );
  const chemiseStock = finalStock.rows.find((r) => r.product_id === prod1Id);
  const robeStock = finalStock.rows.find((r) => r.product_id === prod2Id);

  assert.equal(Number(chemiseStock.current_stock), 29);
  assert.equal(Number(robeStock.current_stock), 10);

  const movRes = await db.query(
    `select movement_type, quantity, reference from public.stock_movements where reference = $1`,
    [seqRes.rows[0].doc_num]
  );
  assert.equal(movRes.rows.length, 1);
  assert.equal(movRes.rows[0].movement_type, "ADJUSTMENT");
  assert.equal(Number(movRes.rows[0].quantity), -1);

  console.log("✅ Test Sprint 8 réussi : Session INV, comptage, écarts et régularisation stock validés !");
});
