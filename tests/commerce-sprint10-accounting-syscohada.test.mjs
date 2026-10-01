import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

test("Sprint 10: SYSCOHADA Chart of accounts, journals, double-entry balanced journal entries, and financial statements calculation", async () => {
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

    create table if not exists public.document_sequences (
      tenant_id uuid not null,
      doc_type text not null check (doc_type in (
        'QUOTE', 'INVOICE', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE',
        'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'STOCK_TRANSFER',
        'INVENTORY_SESSION', 'EXPENSE', 'TREASURY_TRANSFER', 'FIXED_ASSET'
      )),
      year int not null,
      current_number int not null default 0,
      primary key (tenant_id, doc_type, year)
    );
  `);

  // 2. Exécuter la migration Sprint 10
  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), "migrations", "20261001_sprint10_commerce_accounting_syscohada.sql"),
    "utf8"
  );
  await db.exec(migrationSql);

  // 3. Créer établissement et utilisateurs
  const adminUserRes = await db.query(`insert into auth.users default values returning id`);
  const adminUserId = adminUserRes.rows[0].id;

  const compRes = await db.query(
    `insert into public.companies (name, owner_user_id) values ('Ets Commercial Cotonou', $1) returning id`,
    [adminUserId]
  );
  const tenantId = compRes.rows[0].id;

  const currentYear = new Date().getFullYear();

  // 4. Tester la génération de numéro de pièce ECR
  const seqRes = await db.query(`select public.next_document_number($1, 'JOURNAL_ENTRY') as num`, [tenantId]);
  assert.equal(seqRes.rows[0].num, `ECR-${currentYear}-000001`);

  // 5. Initialiser le Plan Comptable SYSCOHADA Révisé
  await db.query(`select public.initialize_tenant_chart_of_accounts($1)`, [tenantId]);

  const coaRes = await db.query(
    `select count(*) as cnt from public.commerce_chart_of_accounts where tenant_id = $1`,
    [tenantId]
  );
  assert.ok(Number(coaRes.rows[0].cnt) >= 25, "Le plan SYSCOHADA doit comporter les comptes standards");

  const journalsRes = await db.query(
    `select code from public.commerce_accounting_journals where tenant_id = $1 order by code`,
    [tenantId]
  );
  const journalCodes = journalsRes.rows.map((r) => r.code);
  assert.ok(journalCodes.includes("VE"));
  assert.ok(journalCodes.includes("AC"));
  assert.ok(journalCodes.includes("BQ"));
  assert.ok(journalCodes.includes("CA"));
  assert.ok(journalCodes.includes("OD"));

  // 6. Enregistrer une pièce de Vente dans le journal VE (Facture avec TVA)
  // Débit : Client 411 = 118 000 FCFA
  // Crédit : Ventes 701 = 100 000 FCFA
  // Crédit : TVA facturée 443 = 18 000 FCFA
  const saleEntryRes = await db.query(
    `insert into public.commerce_journal_entries (
       tenant_id, entry_number, journal_code, entry_date, fiscal_year, period_month,
       reference, description, source_module, total_debit_xof, total_credit_xof, is_balanced
     ) values (
       $1, $2, 'VE', '2026-05-10', 2026, 5,
       'FAC-2026-000001', 'Vente comptoir marchandise avec TVA', 'SALES', 118000, 118000, true
     ) returning id, is_balanced`,
    [tenantId, seqRes.rows[0].num]
  );
  const saleEntryId = saleEntryRes.rows[0].id;
  assert.equal(saleEntryRes.rows[0].is_balanced, true);

  await db.query(
    `insert into public.commerce_journal_entry_lines (
       entry_id, tenant_id, account_number, account_name, debit_amount_xof, credit_amount_xof, partner_name
     ) values
     ($1, $2, '411', 'Clients, créances en compte', 118000, 0, 'Client Comptoir'),
     ($1, $2, '701', 'Ventes de marchandises', 0, 100000, 'Client Comptoir'),
     ($1, $2, '443', 'État, TVA facturée sur ventes', 0, 18000, 'État Béninois')`,
    [saleEntryId, tenantId]
  );

  // 7. Enregistrer le coût d'achat des marchandises vendues (Sortie de stock CMP)
  // Débit : 6031 Variation de stock = 60 000 FCFA
  // Crédit : 311 Stock marchandises = 60 000 FCFA
  const cogsEntryRes = await db.query(
    `insert into public.commerce_journal_entries (
       tenant_id, entry_number, journal_code, entry_date, fiscal_year, period_month,
       reference, description, source_module, total_debit_xof, total_credit_xof, is_balanced
     ) values (
       $1, 'ECR-2026-000002', 'OD', '2026-05-10', 2026, 5,
       'BL-2026-000001', 'Sortie de stock livraison vente FAC-2026-000001', 'INVENTORY', 60000, 60000, true
     ) returning id`,
    [tenantId]
  );
  await db.query(
    `insert into public.commerce_journal_entry_lines (
       entry_id, tenant_id, account_number, account_name, debit_amount_xof, credit_amount_xof
     ) values
     ($1, $2, '6031', 'Variations des stocks de marchandises', 60000, 0),
     ($1, $2, '311', 'Marchandises (Stock magasin)', 0, 60000)`,
    [cogsEntryRes.rows[0].id, tenantId]
  );

  // 8. Enregistrer une charge de loyer payée par Caisse
  // Débit : 632 Loyers = 25 000 FCFA
  // Crédit : 571 Caisse = 25 000 FCFA
  const rentEntryRes = await db.query(
    `insert into public.commerce_journal_entries (
       tenant_id, entry_number, journal_code, entry_date, fiscal_year, period_month,
       reference, description, source_module, total_debit_xof, total_credit_xof, is_balanced
     ) values (
       $1, 'ECR-2026-000003', 'CA', '2026-05-12', 2026, 5,
       'DEP-2026-000001', 'Règlement loyer boutique mai', 'EXPENSES', 25000, 25000, true
     ) returning id`,
    [tenantId]
  );
  await db.query(
    `insert into public.commerce_journal_entry_lines (
       entry_id, tenant_id, account_number, account_name, debit_amount_xof, credit_amount_xof
     ) values
     ($1, $2, '632', 'Loyers et charges locatives', 25000, 0),
     ($1, $2, '571', 'Caisses principales', 0, 25000)`,
    [rentEntryRes.rows[0].id, tenantId]
  );

  // 9. Vérification arithmétique de la Balance Générale
  const balanceAgg = await db.query(
    `select
       sum(debit_amount_xof) as total_debit,
       sum(credit_amount_xof) as total_credit
     from public.commerce_journal_entry_lines
     where tenant_id = $1`,
    [tenantId]
  );
  const totalDebit = Number(balanceAgg.rows[0].total_debit);
  const totalCredit = Number(balanceAgg.rows[0].total_credit);

  assert.equal(totalDebit, 118000 + 60000 + 25000); // 203 000 FCFA
  assert.equal(totalCredit, 118000 + 60000 + 25000); // 203 000 FCFA
  assert.equal(totalDebit, totalCredit, "La balance générale doit être rigoureusement équilibrée");

  // 10. Calcul du Compte de Résultat
  // Produits : 701 = 100 000 FCFA
  // Charges : 6031 (60 000 FCFA) + 632 (25 000 FCFA) = 85 000 FCFA
  // Résultat Net = 100 000 - 85 000 = +15 000 FCFA (Bénéfice)
  const revRes = await db.query(
    `select coalesce(sum(credit_amount_xof - debit_amount_xof), 0) as ca
     from public.commerce_journal_entry_lines
     where tenant_id = $1 and account_number like '7%'`,
    [tenantId]
  );
  const ca = Number(revRes.rows[0].ca);
  assert.equal(ca, 100000);

  const expRes = await db.query(
    `select coalesce(sum(debit_amount_xof - credit_amount_xof), 0) as charges
     from public.commerce_journal_entry_lines
     where tenant_id = $1 and account_number like '6%'`,
    [tenantId]
  );
  const charges = Number(expRes.rows[0].charges);
  assert.equal(charges, 85000);

  const resultatNet = ca - charges;
  assert.equal(resultatNet, 15000, "Le résultat net doit être un bénéfice de 15 000 FCFA");

  console.log("✅ Test Sprint 10 réussi : Plan comptable SYSCOHADA, journaux, écritures équilibrées et états financiers validés !");
});
