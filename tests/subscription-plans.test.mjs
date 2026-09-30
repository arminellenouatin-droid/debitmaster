import assert from "node:assert/strict";
import test from "node:test";
import {
  getSubscriptionActivityCatalog,
  getSubscriptionCatalog,
  getSubscriptionPrice,
  isLegacyActivityCode,
  subscriptionIsExpired,
} from "../src/lib/subscription-plans.ts";

test("Commerce keeps its approved monthly and annual prices", () => {
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "BOUTIQUE_COMMERCE", "MONTHLY"), 50_000);
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "BOUTIQUE_COMMERCE", "ANNUAL"), 450_000);
});

test("Commerce and legacy subscription catalogs remain isolated", () => {
  assert.deepEqual(getSubscriptionCatalog("BOUTIQUE_COMMERCE").map(({ code }) => code), ["BOUTIQUE_COMMERCE"]);
  assert.equal(getSubscriptionCatalog("BUVETTE").some(({ code }) => code === "BOUTIQUE_COMMERCE"), false);
  assert.equal(getSubscriptionPrice("BUVETTE", "BOUTIQUE_COMMERCE"), null);
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "BUVETTE"), null);
});

test("legacy price overrides cannot change the Commerce offer", () => {
  const overrides = [
    { activity_code: "BUVETTE", plan_code: "BOUTIQUE_COMMERCE", billing_period: "MONTHLY", price_xof: 1 },
    { activity_code: "BOUTIQUE_COMMERCE", plan_code: "BOUTIQUE_COMMERCE", billing_period: "MONTHLY", price_xof: 52_000 },
  ];
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "BOUTIQUE_COMMERCE", "MONTHLY", overrides), 52_000);
  assert.equal(getSubscriptionPrice("BOUTIQUE_COMMERCE", "BOUTIQUE_COMMERCE", "MONTHLY", overrides.slice(0, 1)), 50_000);
});

test("multi-activity list includes Commerce without leaking its plan into older activities", () => {
  const activities = getSubscriptionActivityCatalog();
  assert.equal(activities.some(({ code }) => code === "BOUTIQUE_COMMERCE"), true);
  for (const activity of activities.filter(({ code }) => code !== "BOUTIQUE_COMMERCE")) {
    assert.equal(activity.plans.some(({ code }) => code === "BOUTIQUE_COMMERCE"), false);
  }
  assert.equal(isLegacyActivityCode("BUVETTE"), true);
  assert.equal(isLegacyActivityCode("BOUTIQUE_COMMERCE"), false);
});

test("suspended, cancelled, expired and elapsed subscriptions are expired", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(subscriptionIsExpired("SUSPENDED", null, null, now), true);
  assert.equal(subscriptionIsExpired("CANCELLED", null, null, now), true);
  assert.equal(subscriptionIsExpired("ACTIVE", null, "2025-12-31T00:00:00Z", now), true);
  assert.equal(subscriptionIsExpired("ACTIVE", null, "2026-02-01T00:00:00Z", now), false);
});
