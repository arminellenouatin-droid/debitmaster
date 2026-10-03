import assert from "node:assert/strict";
import test from "node:test";
import {
  getSubscriptionActivityCatalog,
  getSubscriptionCatalog,
  getSubscriptionPrice,
  isLegacyActivityCode,
  subscriptionIsExpired,
  referenceActivityConfigs,
  calculateAnnualPrice,
  calculateSpecialPrice,
} from "../src/lib/subscription-plans.ts";

test("PRD v1.1 Reference prices for all 6 activities (Section 2)", () => {
  // 1. Buvette
  assert.equal(getSubscriptionPrice("BUVETTE", "NORMAL", "MONTHLY"), 30_000);
  assert.equal(getSubscriptionPrice("BUVETTE", "NORMAL", "ANNUAL"), 270_000);
  assert.equal(getSubscriptionPrice("BUVETTE", "SPECIAL", "MONTHLY"), 45_000);
  assert.equal(getSubscriptionPrice("BUVETTE", "SPECIAL", "ANNUAL"), 405_000);

  // 2. Bar et restaurant
  assert.equal(getSubscriptionPrice("BAR_RESTAURANT", "NORMAL", "MONTHLY"), 50_000);
  assert.equal(getSubscriptionPrice("BAR_RESTAURANT", "NORMAL", "ANNUAL"), 450_000);
  assert.equal(getSubscriptionPrice("BAR_RESTAURANT", "SPECIAL", "MONTHLY"), 75_000);
  assert.equal(getSubscriptionPrice("BAR_RESTAURANT", "SPECIAL", "ANNUAL"), 675_000);

  // 3. Lounge et night-club
  assert.equal(getSubscriptionPrice("NIGHTCLUB_LOUNGE", "NORMAL", "MONTHLY"), 75_000);
  assert.equal(getSubscriptionPrice("NIGHTCLUB_LOUNGE", "NORMAL", "ANNUAL"), 675_000);
  assert.equal(getSubscriptionPrice("NIGHTCLUB_LOUNGE", "SPECIAL", "MONTHLY"), 112_500);
  assert.equal(getSubscriptionPrice("NIGHTCLUB_LOUNGE", "SPECIAL", "ANNUAL"), 1_012_500);

  // 4. Hôtel et auberge
  assert.equal(getSubscriptionPrice("HOTEL_AUBERGE", "NORMAL", "MONTHLY"), 80_000);
  assert.equal(getSubscriptionPrice("HOTEL_AUBERGE", "NORMAL", "ANNUAL"), 720_000);
  assert.equal(getSubscriptionPrice("HOTEL_AUBERGE", "SPECIAL", "MONTHLY"), 120_000);
  assert.equal(getSubscriptionPrice("HOTEL_AUBERGE", "SPECIAL", "ANNUAL"), 1_080_000);

  // 5. Boutique et commerce
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "NORMAL", "MONTHLY"), 50_000);
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "NORMAL", "ANNUAL"), 450_000);
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "SPECIAL", "MONTHLY"), 75_000);
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "SPECIAL", "ANNUAL"), 675_000);

  // 6. Atelier de couture
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "NORMAL", "MONTHLY"), 100_000);
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "NORMAL", "ANNUAL"), 900_000);
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "SPECIAL", "MONTHLY"), 150_000);
  assert.equal(getSubscriptionPrice("ATELIER_COUTURE", "SPECIAL", "ANNUAL"), 1_350_000);
});

test("Each activity has exactly 2 options: Normal and Special Option", () => {
  const commercePlans = getSubscriptionCatalog("BOUTIQUE_COMMERCE");
  assert.deepEqual(commercePlans.map(({ code }) => code), ["BOUTIQUE_COMMERCE", "BOUTIQUE_COMMERCE_SPECIAL"]);

  const buvettePlans = getSubscriptionCatalog("BUVETTE");
  assert.deepEqual(buvettePlans.map(({ code }) => code), ["BUVETTE", "BUVETTE_SPECIAL"]);
  assert.equal(buvettePlans.some(({ code }) => code.startsWith("BOUTIQUE_COMMERCE")), false);
});

test("Calculation helpers obey PRD rules (25% annual discount and x1.5 special option)", () => {
  assert.equal(calculateAnnualPrice(30_000, 0.25), 270_000);
  assert.equal(calculateSpecialPrice(30_000, 1.5), 45_000);
  assert.equal(calculateAnnualPrice(45_000, 0.25), 405_000);
});

test("Price overrides apply properly", () => {
  const overrides = [
    { activity_code: "BOUTIQUE_COMMERCE", plan_code: "BOUTIQUE_COMMERCE", billing_period: "MONTHLY", price_xof: 52_000 },
  ];
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "NORMAL", "MONTHLY", overrides), 52_000);
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "NORMAL", "MONTHLY"), 50_000);
});

test("Catalog contains all 6 activities with 100% immediate availability", () => {
  const activities = getSubscriptionActivityCatalog();
  assert.equal(activities.length, 6);
  assert.deepEqual(
    activities.map((a) => a.code),
    ["BUVETTE", "BAR_RESTAURANT", "NIGHTCLUB_LOUNGE", "HOTEL_AUBERGE", "BOUTIQUE_COMMERCE", "ATELIER_COUTURE"]
  );
  for (const act of activities) {
    assert.equal(act.isAvailable, true);
    assert.equal(act.plans.length, 2);
  }
});

test("Suspended, cancelled, expired and elapsed subscriptions are expired", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(subscriptionIsExpired("SUSPENDED", null, null, now), true);
  assert.equal(subscriptionIsExpired("CANCELLED", null, null, now), true);
  assert.equal(subscriptionIsExpired("ACTIVE", null, "2025-12-31T00:00:00Z", now), true);
  assert.equal(subscriptionIsExpired("ACTIVE", null, "2026-02-01T00:00:00Z", now), false);
});
