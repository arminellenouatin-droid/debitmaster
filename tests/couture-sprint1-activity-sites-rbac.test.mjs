import assert from "node:assert/strict";
import test from "node:test";
import {
  couturePermissionCatalog,
  couturePermissionKeys,
  coutureRoleLabels,
  coutureCraftLabels,
  coutureSiteTypeLabels,
  defaultCoutureRolePermissions,
  coutureAccessMode,
} from "../src/lib/couture-permissions.ts";
import {
  getSubscriptionActivityCatalog,
  getSubscriptionCatalog,
  getSubscriptionPrice,
  isLegacyActivityCode,
} from "../src/lib/subscription-plans.ts";

test("Couture Sprint 1: Pricing and catalog isolation for ATELIER_COUTURE", () => {
  // Official pricing: 150 000 FCFA / month, 1 350 000 FCFA / year
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "ATELIER_COUTURE", "MONTHLY"), 150_000);
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "ATELIER_COUTURE", "ANNUAL"), 1_350_000);

  // Strict catalog isolation: Couture sees only its own plan
  assert.deepEqual(getSubscriptionCatalog("ATELIER_COUTURE").map(({ code }) => code), ["ATELIER_COUTURE"]);

  // Legacy activities cannot access Couture plan
  assert.equal(getSubscriptionCatalog("BUVETTE").some(({ code }) => code === "ATELIER_COUTURE"), false);
  assert.equal(getSubscriptionCatalog("BAR_RESTAURANT").some(({ code }) => code === "ATELIER_COUTURE"), false);
  assert.equal(getSubscriptionPrice("BUVETTE", "ATELIER_COUTURE"), null);

  // Couture cannot access legacy or commerce plans
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "BUVETTE"), null);
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "BOUTIQUE_COMMERCE"), null);

  // Overrides isolation
  const overrides = [
    { activity_code: "BUVETTE", plan_code: "ATELIER_COUTURE", billing_period: "MONTHLY", price_xof: 1 },
    { activity_code: "ATELIER_COUTURE", plan_code: "ATELIER_COUTURE", billing_period: "MONTHLY", price_xof: 160_000 },
  ];
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "ATELIER_COUTURE", "MONTHLY", overrides), 160_000);
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "ATELIER_COUTURE", "MONTHLY", overrides.slice(0, 1)), 150_000);

  // Activity list inclusion and non-leakage
  const activities = getSubscriptionActivityCatalog();
  assert.equal(activities.some(({ code }) => code === "ATELIER_COUTURE"), true);
  for (const activity of activities.filter(({ code }) => code !== "ATELIER_COUTURE")) {
    assert.equal(activity.plans.some(({ code }) => code === "ATELIER_COUTURE"), false);
  }
  assert.equal(isLegacyActivityCode("ATELIER_COUTURE"), false);
});

test("Couture Sprint 1: Permissions catalog and role definitions integrity", () => {
  const keys = couturePermissionCatalog.map(({ key }) => key);
  assert.equal(new Set(keys).size, keys.length, "All permission keys must be unique");
  assert.equal(couturePermissionKeys.size, keys.length);

  // Essential couture capabilities
  assert.ok(couturePermissionKeys.has("sales.multi_currency"));
  assert.ok(couturePermissionKeys.has("production.assign"));
  assert.ok(couturePermissionKeys.has("piecework.declare"));
  assert.ok(couturePermissionKeys.has("petty_cash.visa"));
  assert.ok(couturePermissionKeys.has("purchases.approve_small"));
  assert.ok(couturePermissionKeys.has("purchases.approve_large"));
  assert.ok(couturePermissionKeys.has("attendance.track"));

  // Check roles completeness
  const expectedRoles = [
    "DIRECTEUR_GERANT", "CHEF_AGENCE", "VENDEUR", "CHEF_ATELIER",
    "OUVRIER", "MAGASINIER_ATELIER", "MAGASINIER_BOUTIQUE",
    "ACHETEUR", "COMPTABLE", "RH", "INVENTAIRE"
  ];
  for (const role of expectedRoles) {
    assert.ok(coutureRoleLabels[role], `Role ${role} must have a descriptive label`);
    assert.ok(Array.isArray(defaultCoutureRolePermissions[role]), `Role ${role} must have default permissions`);
  }

  // Check crafts (métiers) completeness
  const expectedCrafts = ["COUPEUR", "COUTURIER", "BRODEUR_MAIN", "BRODEUR_MACHINE", "FINISSEUR"];
  for (const craft of expectedCrafts) {
    assert.ok(coutureCraftLabels[craft], `Craft ${craft} must have a descriptive label`);
  }

  // Check site types
  assert.equal(coutureSiteTypeLabels.BOUTIQUE, "Boutique (point de vente)");
  assert.equal(coutureSiteTypeLabels.ATELIER, "Atelier (unité de production)");
});

test("Couture Sprint 1: Strict separation of duties and least privilege", () => {
  const ouvrierPerms = new Set(defaultCoutureRolePermissions.OUVRIER);
  assert.ok(ouvrierPerms.has("piecework.declare"));
  assert.ok(ouvrierPerms.has("production.view"));
  assert.equal(ouvrierPerms.has("purchases.approve_small"), false, "Ouvrier cannot approve purchases");
  assert.equal(ouvrierPerms.has("sales.create"), false, "Ouvrier cannot register sales");
  assert.equal(ouvrierPerms.has("treasury.view"), false, "Ouvrier cannot view treasury");

  const vendeurPerms = new Set(defaultCoutureRolePermissions.VENDEUR);
  assert.ok(vendeurPerms.has("sales.create"));
  assert.ok(vendeurPerms.has("sales.multi_currency"));
  assert.equal(vendeurPerms.has("production.assign"), false, "Vendeur cannot assign production tasks");
  assert.equal(vendeurPerms.has("purchases.approve_small"), false, "Vendeur cannot approve purchases");

  const comptablePerms = new Set(defaultCoutureRolePermissions.COMPTABLE);
  assert.ok(comptablePerms.has("purchases.approve_small"), "Comptable can approve purchases < 50 000 FCFA");
  assert.ok(comptablePerms.has("petty_cash.visa"), "Comptable can visa petty cash");
  assert.equal(comptablePerms.has("purchases.approve_large"), false, "Comptable alone cannot approve large purchases >= 50 000 FCFA");

  const rhPerms = new Set(defaultCoutureRolePermissions.RH);
  assert.ok(rhPerms.has("purchases.approve_large"), "RH/Direction can approve large purchases >= 50 000 FCFA");
  assert.ok(rhPerms.has("payroll.approve"), "RH/Direction can approve payroll");

  const chefAtelierPerms = new Set(defaultCoutureRolePermissions.CHEF_ATELIER);
  assert.ok(chefAtelierPerms.has("production.assign"));
  assert.ok(chefAtelierPerms.has("production.quality_control"));
  assert.equal(chefAtelierPerms.has("sales.create"), false, "Chef atelier does not register boutique sales");
});

test("Couture Sprint 1: Subscription access modes and lifecycle", () => {
  const now = Date.UTC(2026, 9, 2);

  // Active status
  assert.equal(
    coutureAccessMode({ status: "ACTIVE", trial_ends_at: null, subscription_expires_at: "2026-11-01T00:00:00Z" }, now),
    "ACTIVE"
  );

  // Grace period (within 5 days of expiration)
  assert.equal(
    coutureAccessMode({ status: "ACTIVE", trial_ends_at: null, subscription_expires_at: "2026-10-01T00:00:00Z" }, now),
    "GRACE"
  );

  // Expired past grace period -> READ_ONLY
  assert.equal(
    coutureAccessMode({ status: "ACTIVE", trial_ends_at: null, subscription_expires_at: "2026-09-20T00:00:00Z" }, now),
    "READ_ONLY"
  );

  // Explicit status
  assert.equal(
    coutureAccessMode({ status: "EXPIRED", trial_ends_at: null, subscription_expires_at: null }, now),
    "READ_ONLY"
  );
  assert.equal(
    coutureAccessMode({ status: "SUSPENDED", trial_ends_at: null, subscription_expires_at: null }, now),
    "BLOCKED"
  );
  assert.equal(
    coutureAccessMode({ status: "CANCELLED", trial_ends_at: null, subscription_expires_at: null }, now),
    "BLOCKED"
  );
});
