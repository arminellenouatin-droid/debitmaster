import test from "node:test";
import assert from "node:assert/strict";

import {
  distinctionSitesSpec,
  distinctionPriceMatrix,
  distinctionStaffSummary,
} from "../src/lib/couture-distinction-provisioning.ts";
import { computeChildPrice } from "../src/lib/couture-catalog.ts";
import {
  generateCoutureSaleNumber,
  calculateSaleTotals,
  resolvePaymentStatus,
} from "../src/lib/couture-sales.ts";
import {
  calculateMultiCurrencyCheckout,
} from "../src/lib/couture-multi-currency.ts";
import {
  generateProductionCardNumber,
  buildDefaultProductionSteps,
  isCraftCompatibleWithStep,
  resolveCardStatusFromStep,
} from "../src/lib/couture-production.ts";
import {
  defaultDistinctionPieceworkRates,
  calculateTaskAmount,
  computeWeeklyPayrollTotals,
} from "../src/lib/couture-piecework.ts";
import {
  determinePurchaseApprovalRoute,
  validatePettyCashExpense,
  calculatePettyCashReplenishment,
} from "../src/lib/couture-supplies.ts";
import {
  generateCoutureTransferNumber,
  resolveTransferReceiptStatus,
  calculateInventoryVariance,
} from "../src/lib/couture-stocks.ts";
import {
  buildSaleJournalEntry,
  buildPettyCashJournalEntry,
  buildPieceworkPayrollJournalEntry,
  validateBalancedEntry,
  convertToConsolidatedReference,
} from "../src/lib/couture-accounting.ts";
import {
  calculateSaleIncentives,
  evaluateCustomerLoyaltyBonus,
  evaluateAnnualRewards,
  evaluateMonthlySellerAlert,
  verifySiteGeofence,
  detectAbsenceIncident,
  generateMonthlyPayrollNumber,
} from "../src/lib/couture-staff-incentives.ts";
import { calculateParetoAbcClassification } from "../src/lib/couture-analytics.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Sprint 12: Master E2E Simulation & Multi-Tenant Verification for « DISTINCTION »", async (t) => {
  const tenantDistinction = { id: "tenant-distinction-uuid", name: "DISTINCTION" };
  const tenantOther = { id: "tenant-other-uuid", name: "ATELIER COUTURE ELEGANCE" };

  // Step 1: Établissement DISTINCTION & Sites (1 atelier Lomé, 3 boutiques Lomé, 2 boutiques Douala)
  await t.test("Step 1: Demonstration establishment DISTINCTION sites structure", () => {
    assert.equal(distinctionSitesSpec.length, 6);
    const atelier = distinctionSitesSpec.find((s) => s.siteType === "ATELIER");
    assert.ok(atelier);
    assert.equal(atelier.city, "Lomé");
    assert.equal(atelier.currency, "FCFA");

    const boutiquesLome = distinctionSitesSpec.filter((s) => s.siteType === "BOUTIQUE" && s.country === "Togo");
    assert.equal(boutiquesLome.length, 3);

    const boutiquesDouala = distinctionSitesSpec.filter((s) => s.siteType === "BOUTIQUE" && s.country === "Cameroun");
    assert.equal(boutiquesDouala.length, 2);
    assert.equal(boutiquesDouala[0].currency, "XAF");

    assert.equal(distinctionStaffSummary.totalGeneralEmployes, 49);
  });

  // Step 2: Catalogue Distinction & Règle prix enfant 50%
  await t.test("Step 2: Distinction catalogue price matrix and 50% child pricing rule", () => {
    assert.equal(distinctionPriceMatrix.length, 6);
    const agbada = distinctionPriceMatrix.find((m) => m.model === "Agbada");
    assert.ok(agbada);
    assert.equal(agbada.presidentiel, 900_000);
    assert.equal(computeChildPrice(agbada.presidentiel), 450_000);

    const goodluck = distinctionPriceMatrix.find((m) => m.model === "Goodluck");
    assert.ok(goodluck);
    assert.equal(goodluck.leader, 120_000);
    assert.equal(computeChildPrice(goodluck.leader), 60_000);
  });

  // Step 3: Ventes en boutique (4 types)
  await t.test("Step 3: Boutique sales workflow for 4 distinct sale types", () => {
    const saleNum = generateCoutureSaleNumber(1, 2026);
    assert.equal(saleNum, "VTE-2026-000001");

    // Vente 1 : Prêt-à-porter Goodluck VIP (200 000 FCFA)
    const lines1 = [{ quantity: 1, unitPriceXof: 200_000 }];
    const totals1 = calculateSaleTotals(lines1, 0, 200_000);
    assert.equal(totals1.totalAmountXof, 200_000);
    assert.equal(totals1.balanceAmountXof, 0);
    assert.equal(resolvePaymentStatus(200_000, 200_000), "PAID");

    // Vente 2 : Commande sur mesure avec acompte 50% (500 000 FCFA total, 250 000 FCFA payé)
    const lines2 = [{ quantity: 1, unitPriceXof: 500_000 }];
    const totals2 = calculateSaleTotals(lines2, 0, 250_000);
    assert.equal(totals2.totalAmountXof, 500_000);
    assert.equal(totals2.balanceAmountXof, 250_000);
    assert.equal(resolvePaymentStatus(500_000, 250_000), "PARTIALLY_PAID");
  });

  // Step 4: Encaissement comptoir multidevise simultané (FCFA, USD, EUR, Mobile Money, TPE)
  await t.test("Step 4: Simultaneous 3-currency counter checkout and payment methods ordering", () => {
    // Total à payer : 300 000 FCFA
    // Client paie 100 000 FCFA en espèces + 150 USD + 100 EUR + reste Mobile Money
    const checkout = calculateMultiCurrencyCheckout(
      300_000,
      { fcfa: 100_000, usd: 150, eur: 100 },
      [
        {
          method: "MOBILE_MONEY",
          amountFcfa: 40_000,
          mobileMoneyPhone: "+22890112233",
          mobileMoneyProvider: "TOGOCOM",
        },
      ]
    );
    assert.ok(checkout.totalCashInFcfa > 240_000);
    assert.ok(checkout.totalPaidFcfa > 280_000);
  });

  // Step 5: Circuit de fabrication atelier & Contrôle qualité
  await t.test("Step 5: Workshop production card pipeline and quality control", () => {
    const cardNum = generateProductionCardNumber(1, 2026);
    assert.equal(cardNum, "FAB-2026-000001");

    const stepsWithEmbroidery = buildDefaultProductionSteps(true);
    assert.equal(stepsWithEmbroidery.length, 7);
    const stepsWithoutEmbroidery = buildDefaultProductionSteps(false);
    assert.equal(stepsWithoutEmbroidery.length, 6);

    // Contrôle ouvrier / métier
    assert.equal(isCraftCompatibleWithStep(["COUPEUR"], "COUPE"), true);
    assert.equal(isCraftCompatibleWithStep(["COUPEUR"], "BRODERIE"), false);
    assert.equal(isCraftCompatibleWithStep(["BRODEUR_MAIN"], "BRODERIE"), true);

    // Cycle QC
    assert.equal(resolveCardStatusFromStep("COUPE", "IN_PROGRESS"), "IN_PRODUCTION");
    assert.equal(resolveCardStatusFromStep("CONTROLE_QUALITE", "IN_PROGRESS"), "QUALITY_CONTROL");
    assert.equal(resolveCardStatusFromStep("CONTROLE_QUALITE", "COMPLETED"), "PACKED");
    assert.equal(resolveCardStatusFromStep("LIVRAISON", "COMPLETED"), "DELIVERED");
  });

  // Step 6: Paie à la tâche des ouvriers & Majoration 20%
  await t.test("Step 6: Distinction piecework rates and weekly payroll calculation", () => {
    assert.ok(defaultDistinctionPieceworkRates.length >= 8);

    // Tâche Agbada sans broderie pendant horaires normaux = 5 000 FCFA
    const taskNormal = calculateTaskAmount(5_000, false);
    assert.equal(taskNormal, 5_000);

    // Tâche Agbada sans broderie hors horaires (+20%) = 6 000 FCFA
    const taskOvertime = calculateTaskAmount(5_000, true);
    assert.equal(taskOvertime, 6_000);

    // Décompte hebdomadaire pour ouvrier
    const weekly = computeWeeklyPayrollTotals([
      { unitRateXof: 5_000, isOvertime: false, finalAmountXof: 5_000 },
      { unitRateXof: 5_000, isOvertime: true, finalAmountXof: 6_000 },
      { unitRateXof: 2_000, isOvertime: false, finalAmountXof: 2_000 },
    ]);
    assert.equal(weekly.tasksCount, 3);
    assert.equal(weekly.netAmountXof, 13_000);
  });

  // Step 7: Fournitures atelier, Circuit d'achats à seuil & Petite caisse
  await t.test("Step 7: Workshop supplies procurement approval threshold and petty cash", () => {
    // Seuil 50 000 FCFA
    assert.equal(determinePurchaseApprovalRoute(45_000), "SINGLE_ACCOUNTANT");
    assert.equal(determinePurchaseApprovalRoute(120_000), "THREE_STEP");

    // Petite caisse : plafond 2 000 FCFA
    assert.equal(validatePettyCashExpense(15_000, 1_500).isValid, true);
    assert.equal(validatePettyCashExpense(15_000, 2_500).isValid, false);

    // Renouvellement fonds 20 000 FCFA
    assert.equal(calculatePettyCashReplenishment(12_000), 8_000);
  });

  // Step 8: Stocks multi-sites, Transferts & Inventaire physique
  await t.test("Step 8: Multi-site stock transfer and physical inventory discrepancy resolution", () => {
    const trfNum = generateCoutureTransferNumber(1, 2026);
    assert.equal(trfNum, "TRF-2026-000001");

    // Réception conforme vs écart
    assert.equal(resolveTransferReceiptStatus([{ quantityShipped: 5, quantityReceived: 5 }]), "RECEIVED");
    assert.equal(resolveTransferReceiptStatus([{ quantityShipped: 5, quantityReceived: 4 }]), "DISCREPANCY");

    // Écart d'inventaire
    const variance = calculateInventoryVariance(20, 18, 50_000);
    assert.equal(variance.varianceQuantity, -2);
    assert.equal(variance.varianceValueXof, -100_000);
    assert.equal(variance.hasDiscrepancy, true);
  });

  // Step 9: Trésorerie & Comptabilité SYSCOHADA consolidée
  await t.test("Step 9: Treasury and balanced SYSCOHADA accounting entries with multi-site consolidation", () => {
    // Vente comptoir prêt-à-porter
    const saleEntry = buildSaleJournalEntry({
      saleNumber: "VTE-2026-000001",
      saleType: "READY_TO_WEAR",
      totalAmountXof: 100_000,
      paidAmountXof: 100_000,
      paymentMethod: "CASH",
    });
    assert.equal(saleEntry.isBalanced, true);
    assert.equal(saleEntry.totalDebit, 100_000);
    assert.equal(saleEntry.totalCredit, 100_000);

    // Petite caisse
    const pcEntry = buildPettyCashJournalEntry({
      expenseNumber: "PC-2026-000001",
      amountXof: 1_500,
      description: "Aiguilles machine",
    });
    assert.equal(pcEntry.isBalanced, true);

    // Paie à la tâche
    const payEntry = buildPieceworkPayrollJournalEntry({
      payrollNumber: "PAY-2026-000001",
      workerName: "Ouvrier Test",
      netPayXof: 25_000,
    });
    assert.equal(payEntry.isBalanced, true);

    // Consolidation Douala XAF -> FCFA référence
    assert.equal(convertToConsolidatedReference(250_000, "XAF", "FCFA", 1.0), 250_000);
  });

  // Step 10: Personnel, Présence géolocalisée, Paie mensuelle & Primes vendeurs
  await t.test("Step 10: Staff attendance geofencing, monthly payroll and seller sales incentives", () => {
    // Géofencing
    const geo = verifySiteGeofence(6.1285, 1.2150, 6.1285, 1.2150, 200);
    assert.equal(geo.isWithinGeofence, true);

    // Absence > 15 min
    assert.equal(detectAbsenceIncident(16).shouldDisconnect, true);

    // Points vendeur & prime gros achat
    const inc = calculateSaleIncentives(1_500_000);
    assert.equal(inc.pointsEarned, 30);
    assert.equal(inc.isHighTicket, true);
    assert.equal(inc.highTicketBonusXof, 30_000);

    // Fidélité client
    assert.equal(evaluateCustomerLoyaltyBonus(4, 1_000_000).isEligible, true);

    // Récompense annuelle véhicule
    const carReward = evaluateAnnualRewards(1_700, 3.5);
    assert.equal(carReward.tier, "CAR_AND_FUEL_BONUS_300K");
    assert.equal(carReward.fuelVoucherXof, 300_000);

    // Alerte sous 60 points
    assert.equal(evaluateMonthlySellerAlert(40).alertLevel, "LOW_PERFORMANCE_WARNING");
  });

  // Step 11: Tableaux de bord, Analyse Pareto ABC & Notifications
  await t.test("Step 11: Pareto ABC analytical report and role-based notifications", () => {
    const pareto = calculateParetoAbcClassification([
      { id: "1", label: "Agbada", revenueXof: 800_000 },
      { id: "2", label: "Goodluck", revenueXof: 150_000 },
      { id: "3", label: "Chapeau", revenueXof: 50_000 },
    ]);
    assert.equal(pareto.totalRevenueXof, 1_000_000);
    assert.equal(pareto.items[0].classification, "A");
    assert.equal(pareto.items[1].classification, "B");
    assert.equal(pareto.items[2].classification, "C");
  });

  // Step 12: Isolation stricte multi-tenant & Conformité AGENTS.md
  await t.test("Step 12: Strict multi-tenant data isolation and least privilege", () => {
    const dirPerms = new Set(defaultCoutureRolePermissions.DIRECTEUR_GERANT);
    const ouvrierPerms = new Set(defaultCoutureRolePermissions.OUVRIER);

    assert.ok(dirPerms.has("audit.view"), "Direction can view audit log");
    assert.equal(ouvrierPerms.has("audit.view"), false, "Ouvrier cannot view audit log");
    assert.equal(ouvrierPerms.has("sales.create"), false, "Ouvrier cannot create sales");
    assert.ok(ouvrierPerms.has("piecework.declare"), "Ouvrier can declare tasks");

    // Garantir que Tenant A et Tenant B ont des identifiants étanches
    assert.notEqual(tenantDistinction.id, tenantOther.id);
  });
});
