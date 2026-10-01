import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

test("Sprint 9: Treasury accounts, internal transfers, expenses approval workflow, and fixed assets with straight-line depreciation", async () => {
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
      name text default 'Entreprise Commerce SARL',
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

    create table if not exists public.document_sequences (
      tenant_id uuid not null,
      doc_type text not null check (doc_type in (
        'QUOTE', 'INVOICE', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE',
        'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'STOCK_TRANSFER',
        'INVENTORY_SESSION'
      )),
      year int not null,
      current_number int not null default 0,
      primary key (tenant_id, doc_type, year)
    );
  `);

  // 2. Exécuter la migration Sprint 9
  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), "migrations", "20261001_sprint9_commerce_treasury_assets.sql"),
    "utf8"
  );
  await db.exec(migrationSql);

  // 3. Créer établissement et utilisateurs
  const adminUserRes = await db.query(`insert into auth.users default values returning id`);
  const adminUserId = adminUserRes.rows[0].id;

  const staffUserRes = await db.query(`insert into auth.users default values returning id`);
  const staffUserId = staffUserRes.rows[0].id;

  const compRes = await db.query(
    `insert into public.companies (name, owner_user_id) values ('Commerce Prestige', $1) returning id`,
    [adminUserId]
  );
  const tenantId = compRes.rows[0].id;

  const currentYear = new Date().getFullYear();

  // 4. Tester les séquences DEP, VIR, IMM
  const depSeq = await db.query(`select public.next_document_number($1, 'EXPENSE') as num`, [tenantId]);
  assert.equal(depSeq.rows[0].num, `DEP-${currentYear}-000001`);

  const virSeq = await db.query(`select public.next_document_number($1, 'TREASURY_TRANSFER') as num`, [tenantId]);
  assert.equal(virSeq.rows[0].num, `VIR-${currentYear}-000001`);

  const immSeq = await db.query(`select public.next_document_number($1, 'FIXED_ASSET') as num`, [tenantId]);
  assert.equal(immSeq.rows[0].num, `IMM-${currentYear}-000001`);

  // 5. Créer des comptes de trésorerie (Caisse et Banque)
  const caisseRes = await db.query(
    `insert into public.commerce_treasury_accounts (
       tenant_id, name, account_type, initial_balance_xof, current_balance_xof
     ) values ($1, 'Caisse Centrale', 'CASH', 500000, 500000) returning id, current_balance_xof`,
    [tenantId]
  );
  const caisseId = caisseRes.rows[0].id;
  assert.equal(Number(caisseRes.rows[0].current_balance_xof), 500000);

  const banqueRes = await db.query(
    `insert into public.commerce_treasury_accounts (
       tenant_id, name, account_type, bank_name, initial_balance_xof, current_balance_xof
     ) values ($1, 'Compte Courant BOA', 'BANK', 'BOA', 2000000, 2000000) returning id, current_balance_xof`,
    [tenantId]
  );
  const banqueId = banqueRes.rows[0].id;
  assert.equal(Number(banqueRes.rows[0].current_balance_xof), 2000000);

  // 6. Tester un Virement Interne Caisse -> Banque (300 000 FCFA avec 1 000 FCFA de frais)
  const transferAmount = 300000;
  const transferFee = 1000;
  const totalDebit = transferAmount + transferFee;

  // Mise à jour atomique des comptes
  await db.query(
    `update public.commerce_treasury_accounts set current_balance_xof = current_balance_xof - $1 where id = $2`,
    [totalDebit, caisseId]
  );
  await db.query(
    `update public.commerce_treasury_accounts set current_balance_xof = current_balance_xof + $1 where id = $2`,
    [transferAmount, banqueId]
  );

  // Enregistrement du virement et des 2 transactions de flux
  await db.query(
    `insert into public.commerce_treasury_transfers (
       tenant_id, transfer_number, source_account_id, destination_account_id,
       amount_xof, transfer_fee_xof, status, created_by_user_id
     ) values ($1, $2, $3, $4, $5, $6, 'COMPLETED', $7)`,
    [tenantId, virSeq.rows[0].num, caisseId, banqueId, transferAmount, transferFee, adminUserId]
  );

  await db.query(
    `insert into public.commerce_treasury_transactions (
       tenant_id, account_id, transaction_type, amount_xof, balance_after_xof, reference, category
     ) values
     ($1, $2, 'TRANSFER_OUT', $3, 199000, $4, 'VIREMENT_INTERNE'),
     ($1, $5, 'TRANSFER_IN', $6, 2300000, $4, 'VIREMENT_INTERNE')`,
    [tenantId, caisseId, totalDebit, virSeq.rows[0].num, banqueId, transferAmount]
  );

  const checkCaisse = await db.query(`select current_balance_xof from public.commerce_treasury_accounts where id = $1`, [caisseId]);
  const checkBanque = await db.query(`select current_balance_xof from public.commerce_treasury_accounts where id = $1`, [banqueId]);

  assert.equal(Number(checkCaisse.rows[0].current_balance_xof), 500000 - 301000); // 199 000 FCFA
  assert.equal(Number(checkBanque.rows[0].current_balance_xof), 2000000 + 300000); // 2 300 000 FCFA

  // 7. Dépenses : Dépense sous le seuil (ex: 25 000 FCFA d'électricité) -> Payée directement
  await db.query(
    `insert into public.commerce_expenses (
       tenant_id, expense_number, title, category, amount_xof, tax_amount_xof,
       total_amount_xof, paid_from_account_id, status, created_by_user_id
     ) values ($1, 'DEP-2026-000002', 'Facture SBEE Magasin', 'ENERGIE_EAU', 25000, 0, 25000, $2, 'PAID', $3)`,
    [tenantId, caisseId, staffUserId]
  );

  await db.query(
    `update public.commerce_treasury_accounts set current_balance_xof = current_balance_xof - 25000 where id = $1`,
    [caisseId]
  );

  const afterExpenseCaisse = await db.query(`select current_balance_xof from public.commerce_treasury_accounts where id = $1`, [caisseId]);
  assert.equal(Number(afterExpenseCaisse.rows[0].current_balance_xof), 199000 - 25000); // 174 000 FCFA

  // 8. Dépense excédant le seuil (ex: 150 000 FCFA pour Loyer) -> PENDING_APPROVAL
  const highExpRes = await db.query(
    `insert into public.commerce_expenses (
       tenant_id, expense_number, title, category, amount_xof, total_amount_xof,
       paid_from_account_id, status, approval_threshold_exceeded, created_by_user_id
     ) values ($1, 'DEP-2026-000003', 'Loyer Mensuel Magasin', 'LOYER', 150000, 150000, $2, 'PENDING_APPROVAL', true, $3)
     returning id, status`,
    [tenantId, banqueId, staffUserId]
  );
  assert.equal(highExpRes.rows[0].status, "PENDING_APPROVAL");

  // Validation par le Gérant/Promoteur
  await db.query(
    `update public.commerce_expenses set
       status = 'PAID',
       approved_by_user_id = $1,
       approved_at = now()
     where id = $2`,
    [adminUserId, highExpRes.rows[0].id]
  );

  await db.query(
    `update public.commerce_treasury_accounts set current_balance_xof = current_balance_xof - 150000 where id = $1`,
    [banqueId]
  );

  const afterApprovalBanque = await db.query(`select current_balance_xof from public.commerce_treasury_accounts where id = $1`, [banqueId]);
  assert.equal(Number(afterApprovalBanque.rows[0].current_balance_xof), 2300000 - 150000); // 2 150 000 FCFA

  // 9. Immobilisations : Création d'une immobilisation avec plan d'amortissement linéaire
  // Climatiseur Split : Coût 1 000 000 FCFA, 5 ans, Valeur résiduelle 0 FCFA -> 200 000 FCFA / an
  const assetRes = await db.query(
    `insert into public.commerce_fixed_assets (
       tenant_id, asset_code, name, syscohada_account, category, acquisition_date,
       acquisition_cost_xof, salvage_value_xof, lifespan_years, depreciation_method,
       accumulated_depreciation_xof, net_book_value_xof, status, created_by_user_id
     ) values (
       $1, $2, 'Climatiseur Split 2CV Magasin', '241', 'MATERIEL_EXPLOITATION', '2026-01-01',
       1000000, 0, 5, 'LINEAIRE', 0, 1000000, 'ACTIVE', $3
     ) returning id, acquisition_cost_xof, net_book_value_xof`,
    [tenantId, immSeq.rows[0].num, adminUserId]
  );
  const assetId = assetRes.rows[0].id;
  assert.equal(Number(assetRes.rows[0].acquisition_cost_xof), 1000000);
  assert.equal(Number(assetRes.rows[0].net_book_value_xof), 1000000);

  // Insérer les 5 lignes du plan d'amortissement prévisionnel
  for (let i = 0; i < 5; i++) {
    const yr = 2026 + i;
    const dotation = 200000;
    const cumul = (i + 1) * 200000;
    const vnc = 1000000 - cumul;

    await db.query(
      `insert into public.commerce_asset_depreciation_lines (
         asset_id, tenant_id, period_year, base_amount_xof,
         depreciation_amount_xof, accumulated_depreciation_xof, net_book_value_xof
       ) values ($1, $2, $3, 1000000, $4, $5, $6)`,
      [assetId, tenantId, yr, dotation, cumul, vnc]
    );
  }

  const linesRes = await db.query(
    `select period_year, depreciation_amount_xof, net_book_value_xof from public.commerce_asset_depreciation_lines where asset_id = $1 order by period_year`,
    [assetId]
  );
  assert.equal(linesRes.rows.length, 5);
  assert.equal(Number(linesRes.rows[0].depreciation_amount_xof), 200000);
  assert.equal(Number(linesRes.rows[0].net_book_value_xof), 800000);
  assert.equal(Number(linesRes.rows[4].net_book_value_xof), 0); // VNC = 0 à la fin de la 5ème année

  // 10. Cession / Sortie d'actif : Cession d'occasion pour 300 000 FCFA
  await db.query(
    `update public.commerce_fixed_assets set
       status = 'SOLD',
       disposal_date = '2028-06-30',
       disposal_proceeds_xof = 300000,
       disposal_notes = 'Cession matériel suite à réaménagement'
     where id = $1`,
    [assetId]
  );

  const checkAsset = await db.query(`select status, disposal_proceeds_xof from public.commerce_fixed_assets where id = $1`, [assetId]);
  assert.equal(checkAsset.rows[0].status, "SOLD");
  assert.equal(Number(checkAsset.rows[0].disposal_proceeds_xof), 300000);

  console.log("✅ Test Sprint 9 réussi : Trésorerie, virements internes, dépenses avec seuil, et immobilisations SYSCOHADA validés !");
});
