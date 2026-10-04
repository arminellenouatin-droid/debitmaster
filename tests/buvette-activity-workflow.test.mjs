import assert from "node:assert/strict";
import test from "node:test";
import {
  getBuvetteLimits,
  companyHasSpecialOption,
  referenceActivityConfigs,
  getSubscriptionPrice,
} from "../src/lib/subscription-plans.ts";
import {
  defaultRolePermissions,
  roleLabels,
} from "../src/lib/staff-permissions.ts";

test("Buvette Activity Limits - Option Normale vs Option Spéciale", () => {
  // Option Normale
  const normalCompany = {
    activity_type: "BUVETTE",
    subscription_plan: "BUVETTE",
    has_special_option: false,
  };
  const normalLimits = getBuvetteLimits(normalCompany);
  assert.equal(normalLimits.maxServeuses, 5);
  assert.equal(normalLimits.maxTables, 15);
  assert.equal(normalLimits.maxStores, 1);
  assert.equal(normalLimits.canUseQrCodeMenu, false);
  assert.equal(normalLimits.canUseAccounting, false);
  assert.equal(normalLimits.canUseTreasuryAssets, false);

  // Option Spéciale (via has_special_option: true)
  const specialCompany = {
    activity_type: "BUVETTE",
    subscription_plan: "BUVETTE",
    has_special_option: true,
  };
  const specialLimits = getBuvetteLimits(specialCompany);
  assert.equal(specialLimits.maxServeuses, null); // Illimité
  assert.equal(specialLimits.maxTables, null); // Illimité
  assert.equal(specialLimits.maxStores, null); // Illimité
  assert.equal(specialLimits.canUseQrCodeMenu, true);
  assert.equal(specialLimits.canUseAccounting, true);
  assert.equal(specialLimits.canUseTreasuryAssets, true);

  // Option Spéciale (via subscription_plan: 'SPECIAL')
  const legacySpecialCompany = {
    activity_type: "BUVETTE",
    subscription_plan: "SPECIAL",
    has_special_option: false,
  };
  assert.equal(getBuvetteLimits(legacySpecialCompany).canUseQrCodeMenu, true);
});

test("Buvette Pricing Matrix conforms to PRD", () => {
  assert.equal(getSubscriptionPrice("BUVETTE", "NORMAL", "MONTHLY"), 30_000);
  assert.equal(getSubscriptionPrice("BUVETTE", "NORMAL", "ANNUAL"), 270_000);
  assert.equal(getSubscriptionPrice("BUVETTE", "SPECIAL", "MONTHLY"), 45_000);
  assert.equal(getSubscriptionPrice("BUVETTE", "SPECIAL", "ANNUAL"), 405_000);
});

test("Buvette Reference Config Features", () => {
  const buvette = referenceActivityConfigs.BUVETTE;
  assert.ok(buvette);
  assert.ok(buvette.normalFeatures.some((f) => f.includes("boissons uniquement")));
  assert.ok(buvette.normalFeatures.some((f) => f.includes("5 serveuses")));
  assert.ok(buvette.normalFeatures.some((f) => f.includes("1 seul magasin")));
  assert.ok(buvette.normalFeatures.some((f) => f.includes("15 tables")));
  assert.ok(buvette.normalFeatures.some((f) => f.includes("approvisionnement")));
  assert.ok(buvette.normalFeatures.some((f) => f.includes("Contrôle journalier")));

  assert.ok(buvette.specialFeatures.some((f) => f.includes("illimitées")));
  assert.ok(buvette.specialFeatures.some((f) => f.includes("QR Code")));
  assert.ok(buvette.specialFeatures.some((f) => f.includes("Comptabilité")));
  assert.ok(buvette.specialFeatures.some((f) => f.includes("Trésorerie")));
});

test("Buvette 5 Operational Staff Roles and Permissions", () => {
  // 1. Serveuse / Serveur
  assert.ok(defaultRolePermissions.SERVEUSE);
  assert.deepEqual(defaultRolePermissions.SERVEUSE, defaultRolePermissions.SERVEUR);
  assert.ok(defaultRolePermissions.SERVEUSE.includes("orders.create"));
  assert.ok(defaultRolePermissions.SERVEUSE.includes("orders.receive"));
  assert.ok(defaultRolePermissions.SERVEUSE.includes("orders.deliver"));
  assert.ok(defaultRolePermissions.SERVEUSE.includes("payments.create"));

  // 2. Gérant
  assert.ok(defaultRolePermissions.GERANT);
  assert.ok(defaultRolePermissions.GERANT.includes("orders.prepare"));
  assert.ok(defaultRolePermissions.GERANT.includes("orders.handoff"));
  assert.ok(defaultRolePermissions.GERANT.includes("stock.accept_counter"));
  assert.ok(defaultRolePermissions.GERANT.includes("team.manage"));
  assert.ok(defaultRolePermissions.GERANT.includes("tables.manage"));

  // 3. Chargé des approvisionnements
  assert.ok(defaultRolePermissions.APPROVISIONNEMENT);
  assert.ok(defaultRolePermissions.APPROVISIONNEMENT.includes("stock.receive"));
  assert.ok(defaultRolePermissions.APPROVISIONNEMENT.includes("purchases.create"));
  assert.ok(defaultRolePermissions.APPROVISIONNEMENT.includes("stock.view"));

  // 4. Chargé des inventaires
  assert.ok(defaultRolePermissions.INVENTAIRE);
  assert.ok(defaultRolePermissions.INVENTAIRE.includes("stock.audit"));
  assert.ok(defaultRolePermissions.INVENTAIRE.includes("inventory.count"));
  assert.ok(defaultRolePermissions.INVENTAIRE.includes("inventory.validate"));
  assert.ok(defaultRolePermissions.INVENTAIRE.includes("reports.daily_close"));

  // 5. Propriétaire / Promoteur (Administrateur)
  assert.ok(defaultRolePermissions.ADMINISTRATEUR);
  assert.ok(defaultRolePermissions.ADMINISTRATEUR.length > 30);

  // Vérification des labels
  assert.equal(roleLabels.SERVEUSE, "Serveuse");
  assert.equal(roleLabels.GERANT, "Gérant");
  assert.equal(roleLabels.APPROVISIONNEMENT, "Approvisionnement");
  assert.equal(roleLabels.INVENTAIRE, "Chargé d’inventaire");
  assert.equal(roleLabels.ADMINISTRATEUR, "Administrateur");
});
