import assert from "node:assert/strict";
import test from "node:test";
import {
  generateCoutureTransferNumber,
  generateCoutureInventoryNumber,
  calculateInventoryVariance,
  resolveTransferReceiptStatus,
} from "../src/lib/couture-stocks.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 8: Sequential numbering for Transfers & Inventories", () => {
  const trf1 = generateCoutureTransferNumber(1, 2026);
  assert.equal(trf1, "TRF-2026-000001");
  assert.match(trf1, /^TRF-\d{4}-\d{6}$/);

  const trf89 = generateCoutureTransferNumber(89, 2026);
  assert.equal(trf89, "TRF-2026-000089");

  const inv1 = generateCoutureInventoryNumber(1, 2026);
  assert.equal(inv1, "INV-2026-000001");
  assert.match(inv1, /^INV-\d{4}-\d{6}$/);

  const inv124 = generateCoutureInventoryNumber(124, 2026);
  assert.equal(inv124, "INV-2026-000124");
});

test("Couture Sprint 8: Inventory variance calculations (surplus, deficit, matching)", () => {
  // 1. Exact match (0 variance)
  const matchRes = calculateInventoryVariance(10, 10, 25_000);
  assert.equal(matchRes.theoreticalQuantity, 10);
  assert.equal(matchRes.countedQuantity, 10);
  assert.equal(matchRes.varianceQuantity, 0);
  assert.equal(matchRes.varianceValueXof, 0);
  assert.equal(matchRes.hasDiscrepancy, false);

  // 2. Deficit / loss (-2 units at 35 000 FCFA each -> -70 000 FCFA)
  const deficitRes = calculateInventoryVariance(12, 10, 35_000);
  assert.equal(deficitRes.theoreticalQuantity, 12);
  assert.equal(deficitRes.countedQuantity, 10);
  assert.equal(deficitRes.varianceQuantity, -2);
  assert.equal(deficitRes.varianceValueXof, -70_000);
  assert.equal(deficitRes.hasDiscrepancy, true);

  // 3. Surplus (+3 units at 15 000 FCFA each -> +45 000 FCFA)
  const surplusRes = calculateInventoryVariance(5, 8, 15_000);
  assert.equal(surplusRes.theoreticalQuantity, 5);
  assert.equal(surplusRes.countedQuantity, 8);
  assert.equal(surplusRes.varianceQuantity, 3);
  assert.equal(surplusRes.varianceValueXof, 45_000);
  assert.equal(surplusRes.hasDiscrepancy, true);
});

test("Couture Sprint 8: Transfer receipt status resolution (conforming vs discrepancy)", () => {
  // Empty items -> RECEIVED
  assert.equal(resolveTransferReceiptStatus([]), "RECEIVED");

  // All items received conform
  const conformingItems = [
    { quantityShipped: 10, quantityReceived: 10 },
    { quantityShipped: 5, quantityReceived: 5 },
    { quantityShipped: 25, quantityReceived: 25 },
  ];
  assert.equal(resolveTransferReceiptStatus(conformingItems), "RECEIVED");

  // Discrepancy detected (shipped 10 but received 8)
  const discrepancyItems1 = [
    { quantityShipped: 10, quantityReceived: 8 },
    { quantityShipped: 5, quantityReceived: 5 },
  ];
  assert.equal(resolveTransferReceiptStatus(discrepancyItems1), "DISCREPANCY");

  // Discrepancy detected (shipped 5 but received 6)
  const discrepancyItems2 = [
    { quantityShipped: 5, quantityReceived: 6 },
  ];
  assert.equal(resolveTransferReceiptStatus(discrepancyItems2), "DISCREPANCY");
});

test("Couture Sprint 8: RBAC authorization on Stock transfers and physical inventories", () => {
  const chefAgencePerms = new Set(defaultCoutureRolePermissions.CHEF_AGENCE);
  assert.ok(chefAgencePerms.has("stock.view"), "Chef d'agence can view stocks");
  assert.ok(chefAgencePerms.has("stock.transfer"), "Chef d'agence can initiate transfers");
  assert.ok(chefAgencePerms.has("inventory.count"), "Chef d'agence can record counts");
  assert.equal(chefAgencePerms.has("inventory.validate"), false, "Chef d'agence cannot validate inventory sessions alone");

  const magasinierBoutiquePerms = new Set(defaultCoutureRolePermissions.MAGASINIER_BOUTIQUE);
  assert.ok(magasinierBoutiquePerms.has("stock.view"), "Magasinier boutique can view stock");
  assert.ok(magasinierBoutiquePerms.has("stock.manage"), "Magasinier boutique can manage stock");
  assert.ok(magasinierBoutiquePerms.has("stock.transfer"), "Magasinier boutique can transfer stock");

  const inventairePerms = new Set(defaultCoutureRolePermissions.INVENTAIRE);
  assert.ok(inventairePerms.has("inventory.view"), "Responsable inventaire can view inventories");
  assert.ok(inventairePerms.has("inventory.count"), "Responsable inventaire can record counts");
  assert.ok(inventairePerms.has("inventory.validate"), "Responsable inventaire can validate inventory sessions");

  const dirGerantPerms = new Set(defaultCoutureRolePermissions.DIRECTEUR_GERANT);
  assert.ok(dirGerantPerms.has("stock.manage"), "Directeur gérant can manage all stocks");
  assert.ok(dirGerantPerms.has("stock.transfer"), "Directeur gérant can transfer stock");
  assert.ok(dirGerantPerms.has("inventory.validate"), "Directeur gérant can validate inventories");
});
