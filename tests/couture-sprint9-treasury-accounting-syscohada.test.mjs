import assert from "node:assert/strict";
import test from "node:test";
import {
  generateCoutureEntryNumber,
  generateCoutureTreasuryTransferNumber,
  coutureSyscohadaCatalog,
  coutureStandardJournals,
  validateBalancedEntry,
  buildSaleJournalEntry,
  buildPettyCashJournalEntry,
  buildPieceworkPayrollJournalEntry,
  convertToConsolidatedReference,
} from "../src/lib/couture-accounting.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 9: Sequential numbering for Journal entries & Treasury transfers", () => {
  const ecr1 = generateCoutureEntryNumber(1, 2026);
  assert.equal(ecr1, "ECR-2026-000001");
  assert.match(ecr1, /^ECR-\d{4}-\d{6}$/);

  const ecr152 = generateCoutureEntryNumber(152, 2026);
  assert.equal(ecr152, "ECR-2026-000152");

  const vir1 = generateCoutureTreasuryTransferNumber(1, 2026);
  assert.equal(vir1, "VIR-2026-000001");
  assert.match(vir1, /^VIR-\d{4}-\d{6}$/);
});

test("Couture Sprint 9: SYSCOHADA Chart of accounts and standard journals catalog", () => {
  assert.ok(coutureSyscohadaCatalog.length >= 25, "Le plan comptable couture doit comporter les comptes clés");

  const accountNumbers = new Set(coutureSyscohadaCatalog.map((a) => a.accountNumber));
  assert.ok(accountNumbers.has("101"), "Capital social");
  assert.ok(accountNumbers.has("215"), "Matériel de confection");
  assert.ok(accountNumbers.has("311"), "Stocks tissus");
  assert.ok(accountNumbers.has("321"), "Stocks fournitures");
  assert.ok(accountNumbers.has("351"), "Stocks vêtements");
  assert.ok(accountNumbers.has("401"), "Fournisseurs");
  assert.ok(accountNumbers.has("411"), "Clients");
  assert.ok(accountNumbers.has("421"), "Personnel rémunérations dues");
  assert.ok(accountNumbers.has("571"), "Caisse boutique");
  assert.ok(accountNumbers.has("572"), "Petite caisse atelier");
  assert.ok(accountNumbers.has("601"), "Achats tissus");
  assert.ok(accountNumbers.has("662"), "Rémunération ouvriers à la tâche");
  assert.ok(accountNumbers.has("701"), "Ventes vêtements finis");
  assert.ok(accountNumbers.has("706"), "Prestations confection et retouche");

  const journalCodes = coutureStandardJournals.map((j) => j.code);
  assert.deepEqual(journalCodes, ["VE", "AC", "BQ", "CA", "OD", "PA"]);
});

test("Couture Sprint 9: Balanced journal entry generator for Sales (with ready-to-wear vs confection)", () => {
  // 1. Vente prêt-à-porter avec acompte et reste dû
  // Total 150 000 FCFA dont 22 881 FCFA TVA, payé 100 000 FCFA en caisse, reste 50 000 FCFA dû par client
  const saleEntry = buildSaleJournalEntry({
    saleNumber: "VTE-2026-000001",
    saleType: "READY_TO_WEAR",
    totalAmountXof: 150_000,
    paidAmountXof: 100_000,
    vatAmountXof: 22_881,
    paymentMethod: "CASH",
  });

  assert.equal(saleEntry.journalCode, "VE");
  assert.equal(saleEntry.isBalanced, true);
  assert.equal(saleEntry.totalDebit, 150_000);
  assert.equal(saleEntry.totalCredit, 150_000);

  // Vérifier les lignes
  const revLine = saleEntry.lines.find((l) => l.accountNumber === "701");
  assert.ok(revLine);
  assert.equal(revLine.credit, 127_119); // 150 000 - 22 881

  const cashLine = saleEntry.lines.find((l) => l.accountNumber === "571");
  assert.ok(cashLine);
  assert.equal(cashLine.debit, 100_000);

  const clientLine = saleEntry.lines.find((l) => l.accountNumber === "411");
  assert.ok(clientLine);
  assert.equal(clientLine.debit, 50_000);

  // 2. Confection sur mesure (tissu apporté par le client -> compte 706 prestations)
  const confectionEntry = buildSaleJournalEntry({
    saleNumber: "VTE-2026-000002",
    saleType: "CUSTOMER_FABRIC_CONFECTION",
    totalAmountXof: 45_000,
    paidAmountXof: 45_000,
    paymentMethod: "MOBILE_MONEY",
  });

  assert.equal(confectionEntry.isBalanced, true);
  assert.equal(confectionEntry.totalDebit, 45_000);
  assert.equal(confectionEntry.totalCredit, 45_000);
  const serviceRev = confectionEntry.lines.find((l) => l.accountNumber === "706");
  assert.ok(serviceRev, "Confection crédite le compte 706 prestations");
  assert.equal(serviceRev.credit, 45_000);
});

test("Couture Sprint 9: Balanced journal entry for Petty cash & Piecework payroll", () => {
  // Petite caisse (Débit 602, Crédit 572)
  const pcEntry = buildPettyCashJournalEntry({
    expenseNumber: "PC-2026-000010",
    amountXof: 1_800,
    description: "Achat aiguilles machine et fermetures éclair",
  });

  assert.equal(pcEntry.journalCode, "CA");
  assert.equal(pcEntry.isBalanced, true);
  assert.equal(pcEntry.totalDebit, 1_800);
  assert.equal(pcEntry.totalCredit, 1_800);

  // Paie à la tâche constatée (Débit 662, Crédit 421)
  const payrollEntry = buildPieceworkPayrollJournalEntry({
    payrollNumber: "PAY-2026-000001",
    workerName: "Koffi Mensah",
    netPayXof: 36_000,
    isDisbursed: false,
  });

  assert.equal(payrollEntry.journalCode, "PA");
  assert.equal(payrollEntry.isBalanced, true);
  assert.equal(payrollEntry.totalDebit, 36_000);
  assert.equal(payrollEntry.totalCredit, 36_000);
  assert.equal(payrollEntry.lines.find((l) => l.accountNumber === "662")?.debit, 36_000);
  assert.equal(payrollEntry.lines.find((l) => l.accountNumber === "421")?.credit, 36_000);
});

test("Couture Sprint 9: Double-entry strict validation guard", () => {
  // Écriture déséquilibrée -> rejet immédiat
  const invalidLines = [
    { accountNumber: "571", label: "Caisse", debit: 50_000, credit: 0 },
    { accountNumber: "701", label: "Ventes", debit: 0, credit: 40_000 },
  ];
  const res = validateBalancedEntry(invalidLines);
  assert.equal(res.isBalanced, false);
  assert.equal(res.difference, 10_000);
});

test("Couture Sprint 9: Multi-currency site consolidation calculations", () => {
  // Même devise (FCFA -> FCFA)
  assert.equal(convertToConsolidatedReference(120_000, "FCFA", "FCFA"), 120_000);

  // Devise XAF (Cameroun) consolidée en XOF/FCFA au pair (taux 1.0)
  assert.equal(convertToConsolidatedReference(500_000, "XAF", "FCFA", 1.0), 500_000);

  // Conversion EUR en FCFA (taux 655.957)
  const convertedEur = convertToConsolidatedReference(200, "EUR", "FCFA", 655.957);
  assert.equal(convertedEur, 131_191);
});

test("Couture Sprint 9: RBAC permissions on Treasury and Accounting", () => {
  const comptablePerms = new Set(defaultCoutureRolePermissions.COMPTABLE);
  assert.ok(comptablePerms.has("treasury.view"), "Comptable views treasury");
  assert.ok(comptablePerms.has("accounting.view"), "Comptable views accounting");

  const dirGerantPerms = new Set(defaultCoutureRolePermissions.DIRECTEUR_GERANT);
  assert.ok(dirGerantPerms.has("treasury.view"), "Directeur gérant views treasury");
  assert.ok(dirGerantPerms.has("accounting.view"), "Directeur gérant views accounting");

  const ouvrierPerms = new Set(defaultCoutureRolePermissions.OUVRIER);
  assert.equal(ouvrierPerms.has("treasury.view"), false, "Ouvrier cannot view treasury");
  assert.equal(ouvrierPerms.has("accounting.view"), false, "Ouvrier cannot view accounting");

  const vendeurPerms = new Set(defaultCoutureRolePermissions.VENDEUR);
  assert.equal(vendeurPerms.has("accounting.view"), false, "Vendeur cannot view accounting");
});
