import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const coutureMigrationSql = await readFile(new URL("../migrations/20261006_couture_model_images.sql", import.meta.url), "utf8");
const accompanimentMigrationSql = await readFile(new URL("../migrations/20261006_meal_accompaniment_images.sql", import.meta.url), "utf8");

async function expectSqlError(action, text) {
  await assert.rejects(action, (error) => String(error).includes(text));
}

test("accompaniment photos are tenant-scoped and Couture models can store images", async () => {
  const db = new PGlite();
  const tenant1 = "20000000-0000-0000-0000-000000000001";
  const tenant2 = "20000000-0000-0000-0000-000000000002";
  const user = "10000000-0000-0000-0000-000000000001";

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      create table public.companies (id uuid primary key);
      create table public.couture_models (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.companies(id), name text not null);
      insert into auth.users(id) values ('${user}');
      insert into public.companies(id) values ('${tenant1}'), ('${tenant2}');
    `);
    await db.exec(coutureMigrationSql);
    await db.exec(accompanimentMigrationSql);

    await db.query(`insert into public.meal_accompaniment_images(tenant_id,name,image_path,updated_by)
      values ('${tenant1}','Riz','${tenant1}/00000000-0000-4000-8000-000000000001.jpg','${user}')`);
    assert.equal((await db.query(`select count(*)::int as count from public.meal_accompaniment_images where tenant_id='${tenant1}'`)).rows[0].count, 1);
    assert.equal((await db.query(`select count(*)::int as count from public.meal_accompaniment_images where tenant_id='${tenant2}'`)).rows[0].count, 0);

    await expectSqlError(
      () => db.query(`insert into public.meal_accompaniment_images(tenant_id,name,image_path) values ('${tenant1}','Riz','${tenant2}/00000000-0000-4000-8000-000000000002.jpg')`),
      "meal_accompaniment_image_tenant_path_check"
    );
    await expectSqlError(
      () => db.query(`insert into public.meal_accompaniment_images(tenant_id,name,image_path) values ('${tenant1}','Sauce','${tenant1}/00000000-0000-4000-8000-000000000003.jpg')`),
      "meal_accompaniment_images_name_check"
    );

    await db.exec(`insert into public.couture_models(tenant_id,name,image_url) values ('${tenant2}','Modèle test','https://images.example.test/model.webp')`);
    assert.equal((await db.query(`select image_url from public.couture_models where tenant_id='${tenant2}' limit 1`)).rows[0].image_url, "https://images.example.test/model.webp");

    await db.exec("set role anon");
    await expectSqlError(() => db.query("select count(*) from public.meal_accompaniment_images"), "permission denied");
    await db.exec("reset role");
    assert.match(accompanimentMigrationSql, /enable row level security/i);
  } finally {
    await db.close();
  }
});
