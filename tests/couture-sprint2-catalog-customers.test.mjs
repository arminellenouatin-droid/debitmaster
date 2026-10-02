import assert from "node:assert/strict";
import test from "node:test";
import {
  computeChildPrice,
  defaultDistinctionModels,
  defaultDistinctionPriceMatrix,
  defaultCoutureRanges,
  defaultCoutureSizes,
  sanitizeBeneficiaries,
  sanitizeMeasurements,
} from "../src/lib/couture-catalog.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 2: Distinction catalogue reference models, ranges and sizes", () => {
  // Check 6 models
  const modelNames = defaultDistinctionModels.map((m) => m.name);
  assert.deepEqual(modelNames, ["Goodluck", "Danshiki", "Agbada", "Abacost", "Robe", "Boubou"]);

  // Check 4 ranges
  const rangeNames = defaultCoutureRanges.map((r) => r.name);
  assert.deepEqual(rangeNames, ["Leader", "VIP", "Royale", "Présidentiel"]);

  // Check sizes (standard + sur mesure)
  const sizeCodes = defaultCoutureSizes.map((s) => s.code);
  assert.ok(sizeCodes.includes("S"));
  assert.ok(sizeCodes.includes("M"));
  assert.ok(sizeCodes.includes("MK"));
  assert.ok(sizeCodes.includes("L"));
  assert.ok(sizeCodes.includes("XL"));
  assert.ok(sizeCodes.includes("2XL"));
  assert.ok(sizeCodes.includes("3XL"));
  assert.ok(sizeCodes.includes("SUR_MESURE"));
});

test("Couture Sprint 2: Distinction price matrix and automatic child pricing (50%)", () => {
  // Goodluck: Leader 120 000 | VIP 200 000 | Royale 350 000 | Présidentiel 500 000
  assert.equal(defaultDistinctionPriceMatrix.Goodluck.Leader, 120_000);
  assert.equal(defaultDistinctionPriceMatrix.Goodluck.VIP, 200_000);
  assert.equal(defaultDistinctionPriceMatrix.Goodluck.Royale, 350_000);
  assert.equal(defaultDistinctionPriceMatrix.Goodluck.Présidentiel, 500_000);

  // Danshiki: Leader 150 000 | VIP 350 000 | Royale 500 000 | Présidentiel 700 000
  assert.equal(defaultDistinctionPriceMatrix.Danshiki.Leader, 150_000);
  assert.equal(defaultDistinctionPriceMatrix.Danshiki.VIP, 350_000);
  assert.equal(defaultDistinctionPriceMatrix.Danshiki.Royale, 500_000);
  assert.equal(defaultDistinctionPriceMatrix.Danshiki.Présidentiel, 700_000);

  // Agbada & Abacost top tier: 900 000
  assert.equal(defaultDistinctionPriceMatrix.Agbada.Présidentiel, 900_000);
  assert.equal(defaultDistinctionPriceMatrix.Abacost.Présidentiel, 900_000);

  // Automatic child prices calculation: adultPrice / 2
  assert.equal(computeChildPrice(120_000), 60_000);
  assert.equal(computeChildPrice(150_000), 75_000);
  assert.equal(computeChildPrice(350_000), 175_000);
  assert.equal(computeChildPrice(500_000), 250_000);
  assert.equal(computeChildPrice(700_000), 350_000);
  assert.equal(computeChildPrice(900_000), 450_000);
  assert.equal(computeChildPrice(0), 0);
  assert.equal(computeChildPrice(-50_000), 0);
});

test("Couture Sprint 2: Tailor measurements sanitization and boundaries", () => {
  const dirtyInput = {
    neck: "42.5",
    chest: 104,
    waist: 88.2,
    hips: "108",
    shoulder_front: 46,
    shoulder_back: 48,
    sleeve_length: 65,
    arm_circumference: 36,
    wrist: 19.5,
    jacket_length: 78,
    pants_length: 105,
    thigh_circumference: 60,
    pants_bottom: 22,
    crotch: 82,
    invalid_prop: 999, // Should be omitted
    fake_extreme: 4500, // Beyond human limit, should be filtered
    negative: -20, // Negative, should be filtered
  };

  const cleaned = sanitizeMeasurements(dirtyInput);
  assert.equal(cleaned.neck, 42.5);
  assert.equal(cleaned.chest, 104);
  assert.equal(cleaned.waist, 88.2);
  assert.equal(cleaned.hips, 108);
  assert.equal(cleaned.shoulder_front, 46);
  assert.equal(cleaned.shoulder_back, 48);
  assert.equal(cleaned.sleeve_length, 65);
  assert.equal(cleaned.wrist, 19.5);
  assert.equal(cleaned.crotch, 82);
  assert.equal(cleaned.invalid_prop, undefined);
  assert.equal(cleaned.fake_extreme, undefined);
  assert.equal(cleaned.negative, undefined);
});

test("Couture Sprint 2: Habitual beneficiaries sanitization", () => {
  const rawList = [
    {
      name: "Kofi Mensah",
      relationship: "Fils aîné",
      gender: "HOMME",
      measurements: { chest: 92, pants_length: 98 },
    },
    {
      name: "Awa Diop",
      relationship: "Épouse",
      gender: "FEMME",
      measurements: { dress_length: 140, waist: 72 },
    },
    {
      name: "X", // Too short name (<2 chars), should be dropped
    },
    null,
  ];

  const cleaned = sanitizeBeneficiaries(rawList);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].name, "Kofi Mensah");
  assert.equal(cleaned[0].relationship, "Fils aîné");
  assert.equal(cleaned[0].measurements.chest, 92);
  assert.equal(cleaned[1].name, "Awa Diop");
  assert.equal(cleaned[1].measurements.dress_length, 140);
});

test("Couture Sprint 2: RBAC permissions for Catalog and Customers", () => {
  const vendeurPerms = new Set(defaultCoutureRolePermissions.VENDEUR);
  assert.ok(vendeurPerms.has("catalog.view"), "Vendeur can view catalog");
  assert.ok(vendeurPerms.has("customers.view"), "Vendeur can view customers");
  assert.ok(vendeurPerms.has("customers.manage"), "Vendeur can manage customers & measurements");
  assert.equal(vendeurPerms.has("catalog.manage"), false, "Vendeur cannot modify models/price grid");

  const ouvrierPerms = new Set(defaultCoutureRolePermissions.OUVRIER);
  assert.equal(ouvrierPerms.has("catalog.view"), false, "Ouvrier cannot view retail catalog");
  assert.equal(ouvrierPerms.has("customers.manage"), false, "Ouvrier cannot manage customers");

  const chefAgencePerms = new Set(defaultCoutureRolePermissions.CHEF_AGENCE);
  assert.ok(chefAgencePerms.has("catalog.view"));
  assert.ok(chefAgencePerms.has("customers.manage"));
  assert.equal(chefAgencePerms.has("catalog.manage"), false, "Chef agence cannot alter official price grid");

  const dirPerms = new Set(defaultCoutureRolePermissions.DIRECTEUR_GERANT);
  assert.ok(dirPerms.has("catalog.manage"), "Direction can manage models and price grid");
  assert.ok(dirPerms.has("customers.manage"), "Direction can manage customers");
});
