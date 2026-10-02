import assert from "node:assert/strict";
import test from "node:test";
import {
  determinePurchaseApprovalRoute,
  generatePurchaseRequestNumber,
  generatePettyCashExpenseNumber,
  validatePettyCashExpense,
  calculatePettyCashReplenishment,
  PURCHASE_APPROVAL_THRESHOLD_XOF,
  PETTY_CASH_MAX_EXPENSE_XOF,
  PETTY_CASH_DEFAULT_FUND_XOF,
} from "../src/lib/couture-supplies.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 7: Purchase approval route threshold (50 000 FCFA)", () => {
  assert.equal(PURCHASE_APPROVAL_THRESHOLD_XOF, 50_000);

  // Small purchases < 50 000 FCFA -> SINGLE_ACCOUNTANT
  assert.equal(determinePurchaseApprovalRoute(15_000), "SINGLE_ACCOUNTANT");
  assert.equal(determinePurchaseApprovalRoute(49_999), "SINGLE_ACCOUNTANT");

  // Large purchases >= 50 000 FCFA -> THREE_STEP (Avis acheteur -> Comptable -> Direction)
  assert.equal(determinePurchaseApprovalRoute(50_000), "THREE_STEP");
  assert.equal(determinePurchaseApprovalRoute(150_000), "THREE_STEP");
  assert.equal(determinePurchaseApprovalRoute(1_500_000), "THREE_STEP");
});

test("Couture Sprint 7: Sequential numbering for Purchase Requests & Petty Cash", () => {
  const req1 = generatePurchaseRequestNumber(1, 2026);
  assert.equal(req1, "DA-2026-000001");
  assert.match(req1, /^DA-\d{4}-\d{6}$/);

  const pc45 = generatePettyCashExpenseNumber(45, 2026);
  assert.equal(pc45, "PC-2026-000045");
  assert.match(pc45, /^PC-\d{4}-\d{6}$/);
});

test("Couture Sprint 7: Petty cash expenditure ceiling (2 000 FCFA) and balance guards", () => {
  assert.equal(PETTY_CASH_MAX_EXPENSE_XOF, 2_000);
  const currentBalance = 15_000;

  // Valid expenses <= 2 000 FCFA
  const v1 = validatePettyCashExpense(currentBalance, 1_500);
  assert.equal(v1.isValid, true);

  const v2 = validatePettyCashExpense(currentBalance, 2_000);
  assert.equal(v2.isValid, true);

  // Expenses > 2 000 FCFA must be rejected
  const v3 = validatePettyCashExpense(currentBalance, 2_001);
  assert.equal(v3.isValid, false);
  assert.ok(v3.error?.includes("Plafond dépassé"));

  const v4 = validatePettyCashExpense(currentBalance, 5_000);
  assert.equal(v4.isValid, false);

  // Insufficient fund balance
  const lowBalance = 1_000;
  const v5 = validatePettyCashExpense(lowBalance, 1_500);
  assert.equal(v5.isValid, false);
  assert.ok(v5.error?.includes("Solde insuffisant"));
});

test("Couture Sprint 7: Petty cash replenishment calculation (20 000 FCFA fund limit)", () => {
  assert.equal(PETTY_CASH_DEFAULT_FUND_XOF, 20_000);

  // Exhausted fund (0 FCFA) -> needs 20 000 FCFA
  assert.equal(calculatePettyCashReplenishment(0), 20_000);

  // Balance at 14 500 FCFA -> needs 5 500 FCFA
  assert.equal(calculatePettyCashReplenishment(14_500), 5_500);

  // Balance at 3 000 FCFA -> needs 17 000 FCFA
  assert.equal(calculatePettyCashReplenishment(3_000), 17_000);

  // Full fund (20 000 FCFA) -> 0 FCFA
  assert.equal(calculatePettyCashReplenishment(20_000), 0);
});

test("Couture Sprint 7: RBAC authorization on Supplies, Purchases & Petty Cash", () => {
  const magasinierPerms = new Set(defaultCoutureRolePermissions.MAGASINIER_ATELIER);
  assert.ok(magasinierPerms.has("supplies.view"), "Magasinier can view supplies");
  assert.ok(magasinierPerms.has("supplies.manage"), "Magasinier manages supplies");
  assert.ok(magasinierPerms.has("purchases.request"), "Magasinier requests purchases");
  assert.ok(magasinierPerms.has("petty_cash.view"), "Magasinier views petty cash");
  assert.ok(magasinierPerms.has("petty_cash.spend"), "Magasinier spends petty cash up to 2k");
  assert.equal(magasinierPerms.has("purchases.approve_small"), false, "Magasinier cannot approve purchases");
  assert.equal(magasinierPerms.has("petty_cash.visa"), false, "Magasinier cannot visa his own petty cash expenses");

  const comptablePerms = new Set(defaultCoutureRolePermissions.COMPTABLE);
  assert.ok(comptablePerms.has("purchases.approve_small"), "Comptable approves purchases < 50 000 FCFA");
  assert.ok(comptablePerms.has("petty_cash.visa"), "Comptable visas petty cash expenses and renewals");
  assert.equal(comptablePerms.has("purchases.approve_large"), false, "Comptable cannot approve purchases >= 50 000 FCFA alone");

  const rhDirectionPerms = new Set(defaultCoutureRolePermissions.RH);
  assert.ok(rhDirectionPerms.has("purchases.approve_large"), "Direction / RH gives final approval on purchases >= 50 000 FCFA");
});
