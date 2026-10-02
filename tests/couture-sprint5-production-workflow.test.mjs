import assert from "node:assert/strict";
import test from "node:test";
import {
  generateProductionCardNumber,
  buildDefaultProductionSteps,
  isCraftCompatibleWithStep,
  resolveCardStatusFromStep,
} from "../src/lib/couture-production.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 5: Production card sequential numbering", () => {
  const card1 = generateProductionCardNumber(1, 2026);
  assert.equal(card1, "FAB-2026-000001");

  const card105 = generateProductionCardNumber(105, 2026);
  assert.equal(card105, "FAB-2026-000105");

  assert.match(card1, /^FAB-\d{4}-\d{6}$/);
  assert.match(card105, /^FAB-\d{4}-\d{6}$/);
});

test("Couture Sprint 5: Fixed production steps pipeline (with & without embroidery)", () => {
  // Without embroidery: 6 steps
  const stepsWithoutEmb = buildDefaultProductionSteps(false);
  assert.equal(stepsWithoutEmb.length, 6);
  assert.deepEqual(
    stepsWithoutEmb.map((s) => s.stepType),
    ["COUPE", "COUTURE", "FINITION_REPASSAGE", "CONTROLE_QUALITE", "EMBALLAGE", "LIVRAISON"]
  );

  // With embroidery: 7 steps (Broderie inserted after Couture)
  const stepsWithEmb = buildDefaultProductionSteps(true);
  assert.equal(stepsWithEmb.length, 7);
  assert.deepEqual(
    stepsWithEmb.map((s) => s.stepType),
    ["COUPE", "COUTURE", "BRODERIE", "FINITION_REPASSAGE", "CONTROLE_QUALITE", "EMBALLAGE", "LIVRAISON"]
  );

  // Sequential order is strictly 1 to N
  assert.equal(stepsWithEmb[0].stepOrder, 1);
  assert.equal(stepsWithEmb[6].stepOrder, 7);
});

test("Couture Sprint 5: Worker craft compatibility with production steps", () => {
  const coupeurOnly = ["COUPEUR"];
  assert.equal(isCraftCompatibleWithStep(coupeurOnly, "COUPE"), true);
  assert.equal(isCraftCompatibleWithStep(coupeurOnly, "COUTURE"), false);
  assert.equal(isCraftCompatibleWithStep(coupeurOnly, "BRODERIE"), false);

  const couturierOnly = ["COUTURIER"];
  assert.equal(isCraftCompatibleWithStep(couturierOnly, "COUPE"), false);
  assert.equal(isCraftCompatibleWithStep(couturierOnly, "COUTURE"), true);
  assert.equal(isCraftCompatibleWithStep(couturierOnly, "FINITION_REPASSAGE"), true);

  const brodeurMain = ["BRODEUR_MAIN"];
  assert.equal(isCraftCompatibleWithStep(brodeurMain, "BRODERIE"), true);
  assert.equal(isCraftCompatibleWithStep(brodeurMain, "COUTURE"), false);

  const polyvalent = ["COUPEUR", "COUTURIER", "FINISSEUR"];
  assert.equal(isCraftCompatibleWithStep(polyvalent, "COUPE"), true);
  assert.equal(isCraftCompatibleWithStep(polyvalent, "COUTURE"), true);
  assert.equal(isCraftCompatibleWithStep(polyvalent, "FINITION_REPASSAGE"), true);
  assert.equal(isCraftCompatibleWithStep(polyvalent, "BRODERIE"), false);
});

test("Couture Sprint 5: Card status resolution and quality control transition", () => {
  // During production steps
  assert.equal(resolveCardStatusFromStep("COUPE", "IN_PROGRESS"), "IN_PRODUCTION");
  assert.equal(resolveCardStatusFromStep("COUTURE", "COMPLETED"), "IN_PRODUCTION");
  assert.equal(resolveCardStatusFromStep("FINITION_REPASSAGE", "COMPLETED"), "IN_PRODUCTION");

  // At Quality Control
  assert.equal(resolveCardStatusFromStep("CONTROLE_QUALITE", "PENDING"), "QUALITY_CONTROL");
  assert.equal(resolveCardStatusFromStep("CONTROLE_QUALITE", "IN_PROGRESS"), "QUALITY_CONTROL");
  assert.equal(resolveCardStatusFromStep("CONTROLE_QUALITE", "COMPLETED"), "PACKED");
  assert.equal(resolveCardStatusFromStep("CONTROLE_QUALITE", "REJECTED"), "IN_PRODUCTION");

  // Packaging and Delivery
  assert.equal(resolveCardStatusFromStep("EMBALLAGE", "COMPLETED"), "READY_FOR_DELIVERY");
  assert.equal(resolveCardStatusFromStep("LIVRAISON", "COMPLETED"), "DELIVERED");
});

test("Couture Sprint 5: RBAC authorization on Workshop Production & QC", () => {
  const chefAtelierPerms = new Set(defaultCoutureRolePermissions.CHEF_ATELIER);
  assert.ok(chefAtelierPerms.has("production.view"), "Chef atelier can view production pipeline");
  assert.ok(chefAtelierPerms.has("production.manage"), "Chef atelier can manage production");
  assert.ok(chefAtelierPerms.has("production.assign"), "Chef atelier can assign steps to workers");
  assert.ok(chefAtelierPerms.has("production.quality_control"), "Chef atelier performs quality control");

  const ouvrierPerms = new Set(defaultCoutureRolePermissions.OUVRIER);
  assert.ok(ouvrierPerms.has("production.view"), "Ouvrier can view his tasks");
  assert.ok(ouvrierPerms.has("piecework.declare"), "Ouvrier can declare task completion");
  assert.equal(ouvrierPerms.has("production.assign"), false, "Ouvrier cannot assign tasks");
  assert.equal(ouvrierPerms.has("production.quality_control"), false, "Ouvrier cannot perform QC");

  const vendeurPerms = new Set(defaultCoutureRolePermissions.VENDEUR);
  assert.equal(vendeurPerms.has("production.manage"), false, "Vendeur cannot manage workshop production");
  assert.equal(vendeurPerms.has("production.quality_control"), false, "Vendeur cannot perform workshop QC");
});
