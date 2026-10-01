import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("../", import.meta.url);
const migration = async (name) => readFile(new URL(`migrations/${name}`, root), "utf8");

async function expectSqlError(action, code) {
  let rejected = false;
  try {
    await action();
  } catch (error) {
    rejected = String(error).includes(code);
  }
  assert.equal(rejected, true, `expected PostgreSQL error containing ${code}`);
}

test("Commerce Sprint 3 isolates, reserves and audits stock by store", async () => {
  const db = new PGlite();
  const user1 = "10000000-0000-0000-0000-000000000001";
  const user2 = "10000000-0000-0000-0000-000000000002";
  const user3 = "10000000-0000-0000-0000-000000000003";
  const tenant1 = "20000000-0000-0000-0000-000000000003";
  const tenant2 = "20000000-0000-0000-0000-000000000004";
  const product1 = "40000000-0000-0000-0000-000000000001";

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create schema private;
      create schema storage;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      create table public.companies (
        id uuid primary key default gen_random_uuid(), activity_type text not null,
        status text not null default 'TRIAL', owner_user_id uuid references auth.users(id),
        subscription_expires_at timestamptz, trial_ends_at timestamptz, deleted_at timestamptz,
        currency varchar not null default 'XOF',
        constraint companies_activity_type_check check (activity_type = any (array['BUVETTE','BAR_RESTAURANT','NIGHTCLUB_LOUNGE','HOTEL_AUBERGE']))
      );
      create table public.saas_plan_prices (
        id uuid primary key default gen_random_uuid(), activity_code text not null, plan_code text not null,
        billing_period text not null, price_xof integer not null check (price_xof > 0), description text,
        is_active boolean not null default true, updated_by uuid, created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint saas_plan_prices_activity_code_check check (activity_code = any (array['BUVETTE','BAR_RESTAURANT','NIGHTCLUB_LOUNGE','HOTEL_AUBERGE'])),
        constraint saas_plan_prices_plan_code_check check (plan_code = any (array['BUVETTE','BAR_RESTAURANT','HOTEL_AUBERGE'])),
        constraint saas_plan_prices_activity_plan_period_key unique (activity_code, plan_code, billing_period)
      );
      create table public.saas_subscription_payments (
        id uuid primary key default gen_random_uuid(), tenant_id uuid, plan text, billing_period text,
        amount integer, currency varchar, status text, metadata jsonb not null default '{}'::jsonb
      );
      create table public.profiles (
        id uuid primary key references auth.users(id), role text,
        must_change_password boolean not null default false, updated_at timestamptz not null default now()
      );
      create table storage.buckets (
        id text primary key, name text not null, public boolean not null default false,
        file_size_limit bigint, allowed_mime_types text[]
      );
      create table public.customers (id uuid primary key default gen_random_uuid(), tenant_id uuid);
      insert into auth.users(id) values ('${user1}'),('${user2}'),('${user3}');
      insert into public.companies(id,activity_type,status,owner_user_id,trial_ends_at) values
        ('20000000-0000-0000-0000-000000000001','BUVETTE','TRIAL','${user1}',now()+interval '30 days'),
        ('20000000-0000-0000-0000-000000000002','HOTEL_AUBERGE','ACTIVE','${user2}',now()+interval '30 days');
      insert into public.saas_plan_prices(activity_code,plan_code,billing_period,price_xof) values ('BUVETTE','BUVETTE','MONTHLY',10000);
      insert into public.customers(tenant_id) values ('20000000-0000-0000-0000-000000000001');
    `);
    await db.exec(await migration("20260928_boutique_commerce_sprint_1.sql"));
    await db.exec(`insert into public.companies(id,activity_type,status,owner_user_id,trial_ends_at) values ('${tenant1}','BOUTIQUE_COMMERCE','TRIAL','${user1}',now()+interval '30 days')`);
    await db.exec(await migration("20260929_boutique_commerce_catalog_sprint_2.sql"));
    await db.exec(`insert into public.companies(id,activity_type,status,owner_user_id,trial_ends_at) values ('${tenant2}','BOUTIQUE_COMMERCE','TRIAL','${user2}',now()+interval '30 days')`);
    await db.exec(await migration("20261001_boutique_commerce_stock_sprint_3.sql"));
    await db.exec(`
      insert into public.commerce_categories(id,tenant_id,name,created_by)
      values ('30000000-0000-0000-0000-000000000001','${tenant1}','Divers','${user1}');
      insert into public.commerce_products(id,tenant_id,category_id,internal_code,name,base_unit,price_retail_xof,min_stock,reorder_point,created_by)
      values ('${product1}','${tenant1}','30000000-0000-0000-0000-000000000001','SKU-1','Produit test','unité',1000,2,3,'${user1}');
    `);

    const store1 = (await db.query(`select id from public.commerce_stores where tenant_id='${tenant1}' limit 1`)).rows[0].id;
    await db.exec(`insert into public.commerce_stores(tenant_id,name,store_type,created_by) values ('${tenant1}','Annexe','WAREHOUSE','${user1}')`);
    const store2 = (await db.query(`select id from public.commerce_stores where tenant_id='${tenant1}' and name='Annexe' limit 1`)).rows[0].id;

    const receipt = await db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store1}','${product1}','RECEIPT',10,'Réception initiale',null,'receipt-test-001','${user1}') as result`);
    assert.equal(Number(receipt.rows[0].result.quantityAfter), 10);
    const repeated = await db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store1}','${product1}','RECEIPT',10,'Réception initiale',null,'receipt-test-001','${user1}') as result`);
    assert.equal(repeated.rows[0].result.idempotent, true);
    assert.equal((await db.query(`select count(*)::int as n from public.commerce_stock_movements where tenant_id='${tenant1}'`)).rows[0].n, 1);
    await expectSqlError(() => db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store1}','${product1}','RECEIPT',10,'Réception initiale','Réf différente','receipt-test-001','${user1}')`), "stock_idempotency_conflict");

    await db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store1}','${product1}','ISSUE',2,'Sortie test',null,'issue-test-001','${user1}')`);
    const reservation = await db.query(`select public.create_commerce_stock_reservation(
      '${tenant1}','${store1}','${product1}',3,'Commande temporaire','reserve-test-001','${user1}') as result`);
    const reservationId = reservation.rows[0].result.id;
    const level = (await db.query(`select physical_quantity,reserved_quantity,available_quantity,alert_status
      from public.commerce_stock_levels where tenant_id='${tenant1}' and store_id='${store1}' and product_id='${product1}'`)).rows[0];
    assert.equal(Number(level.physical_quantity), 8);
    assert.equal(Number(level.reserved_quantity), 3);
    assert.equal(Number(level.available_quantity), 5);
    assert.equal(level.alert_status, "HEALTHY");
    await expectSqlError(() => db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store1}','${product1}','ISSUE',6,'Sortie dépassant les réservations',null,'issue-reserved-01','${user1}')`), "stock_reserved_quantity");
    await expectSqlError(() => db.query(`select public.create_commerce_stock_reservation(
      '${tenant1}','${store1}','${product1}',6,'Réservation trop grande','reserve-too-large-1','${user1}')`), "stock_insufficient");

    await db.query(`select public.release_commerce_stock_reservation('${tenant1}','${reservationId}','${user1}','Libération test')`);
    await expectSqlError(() => db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store1}','${product1}','ISSUE',9,'Sortie au-delà du stock',null,'issue-short-001','${user1}')`), "stock_insufficient");

    await db.query(`select public.update_commerce_stock_settings('${tenant1}',true,1440,'${user1}')`);
    const allowedNegative = await db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store1}','${product1}','ISSUE',9,'Sortie autorisée explicitement',null,'issue-negative-01','${user1}') as result`);
    assert.equal(Number(allowedNegative.rows[0].result.quantityAfter), -1);

    await db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store2}','${product1}','RECEIPT',5,'Réception annexe',null,'receipt-store-002','${user1}')`);
    const storeLevels = (await db.query(`select store_id,physical_quantity from public.commerce_stock_levels
      where tenant_id='${tenant1}' and product_id='${product1}' order by store_id`)).rows;
    assert.equal(storeLevels.length, 2);
    assert.equal(Number(storeLevels.find((row) => row.store_id === store1).physical_quantity), -1);
    assert.equal(Number(storeLevels.find((row) => row.store_id === store2).physical_quantity), 5);

    const seller = (await db.query(`insert into public.commerce_employees(
      tenant_id,user_id,first_name,last_name,phone,status,must_change_password,created_by
    ) values ('${tenant1}','${user3}','Vendeur','Test','+22501020304','ACTIVE',false,'${user1}') returning id`)).rows[0].id;
    const sellerRole = (await db.query(`select id from public.commerce_roles where tenant_id='${tenant1}' and role_key='VENDEUR'`)).rows[0].id;
    await db.exec(`
      insert into public.commerce_employee_roles(tenant_id,employee_id,role_id,assigned_by) values ('${tenant1}','${seller}','${sellerRole}','${user1}');
      insert into public.commerce_employee_stores(tenant_id,employee_id,store_id,assigned_by) values ('${tenant1}','${seller}','${store2}','${user1}');
    `);
    const sellerReservation = await db.query(`select public.create_commerce_stock_reservation(
      '${tenant1}','${store2}','${product1}',1,'Réservation liée à une vente','seller-reserve-001','${user3}') as result`);
    const sellerReservationId = sellerReservation.rows[0].result.id;
    await expectSqlError(() => db.query(`select public.create_commerce_stock_reservation(
      '${tenant1}','${store1}','${product1}',1,'Magasin hors affectation','seller-reserve-002','${user3}')`), "commerce_stock_forbidden");
    await expectSqlError(() => db.query(`select public.release_commerce_stock_reservation(
      '${tenant1}','${sellerReservationId}','${user3}','Tentative non autorisée')`), "commerce_stock_forbidden");
    await db.query(`select public.release_commerce_stock_reservation('${tenant1}','${sellerReservationId}','${user1}','Libération par le promoteur')`);

    const expiring = await db.query(`select public.create_commerce_stock_reservation(
      '${tenant1}','${store2}','${product1}',1,'Test expiration','reserve-expire-01','${user1}') as result`);
    const expiringId = expiring.rows[0].result.id;
    await db.exec(`update public.commerce_stock_reservations set expires_at=now()-interval '1 minute' where id='${expiringId}'`);
    assert.equal(Number((await db.query(`select reserved_quantity from public.commerce_stock_levels
      where tenant_id='${tenant1}' and store_id='${store2}' and product_id='${product1}'`)).rows[0].reserved_quantity), 0);
    const expired = await db.query(`select public.expire_commerce_stock_reservations('${tenant1}','${store2}') as n`);
    assert.equal(expired.rows[0].n, 1);
    assert.equal((await db.query(`select status from public.commerce_stock_reservations where id='${expiringId}'`)).rows[0].status, "EXPIRED");
    assert.equal(Number((await db.query(`select reserved_quantity from public.commerce_stock_levels
      where tenant_id='${tenant1}' and store_id='${store2}' and product_id='${product1}'`)).rows[0].reserved_quantity), 0);

    await expectSqlError(() => db.exec(`update public.commerce_stock_movements set reason='modifié' where tenant_id='${tenant1}'`), "COMMERCE_STOCK_MOVEMENTS_IMMUTABLE");
    await expectSqlError(() => db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store1}','${product1}','RECEIPT',1,'Tentative inter-tenant',null,'cross-tenant-01','${user2}')`), "commerce_stock_forbidden");

    await db.exec("set role authenticated");
    await expectSqlError(() => db.query("select count(*) from public.commerce_stock_balances"), "permission denied");
    await expectSqlError(() => db.query(`select public.record_commerce_stock_movement(
      '${tenant1}','${store1}','${product1}','RECEIPT',1,'RPC non autorisé',null,'rpc-denied-001','${user1}')`), "permission denied");
    await db.exec("reset role");

    const auditCount = (await db.query(`select count(*)::int as n from public.commerce_audit_events
      where tenant_id='${tenant1}' and entity_type in ('STOCK_MOVEMENT','STOCK_RESERVATION','STOCK_SETTINGS')`)).rows[0].n;
    assert.ok(auditCount >= 7);
  } finally {
    await db.close();
  }
});
