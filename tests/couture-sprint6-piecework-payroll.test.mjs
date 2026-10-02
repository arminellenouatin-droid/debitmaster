import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDistinctionPieceworkRates,
  calculateTaskAmount,
  computeWeeklyPayrollTotals,
} from "../src/lib/couture-piecework.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 6: Distinction piecework rates reference barème", () => {
  const codes = defaultDistinctionPieceworkRates.map((r) => r.taskCode);
  assert.ok(codes.includes("CHAPEAU"));
  assert.ok(codes.includes("AGBADA"));
  assert.ok(codes.includes("HAUT_GOODLUCK"));
  assert.ok(codes.includes("HAUT_DANSHIKI"));
  assert.ok(codes.includes("PANTALON_DROIT"));
  assert.ok(codes.includes("PANTALON_SIMPLE"));
  assert.ok(codes.includes("ROBE"));
  assert.ok(codes.includes("BOUBOU"));

  // Check specific rates
  const agbada = defaultDistinctionPieceworkRates.find((r) => r.taskCode === "AGBADA");
  assert.equal(agbada.rateWithoutEmbroideryXof, 5_000);
  assert.equal(agbada.rateWithEmbroideryXof, 6_000);

  const goodluck = defaultDistinctionPieceworkRates.find((r) => r.taskCode === "HAUT_GOODLUCK");
  assert.equal(goodluck.rateWithoutEmbroideryXof, 1_600);
  assert.equal(goodluck.rateWithEmbroideryXof, 3_000);

  const danshiki = defaultDistinctionPieceworkRates.find((r) => r.taskCode === "HAUT_DANSHIKI");
  assert.equal(danshiki.rateWithoutEmbroideryXof, 2_000);
  assert.equal(danshiki.rateWithEmbroideryXof, 4_000);
});

test("Couture Sprint 6: Task amount calculation and 20% overtime majoration", () => {
  // Normal rate
  assert.equal(calculateTaskAmount(5_000, false), 5_000);
  assert.equal(calculateTaskAmount(6_000, false), 6_000);

  // Overtime rate: 20% majoration (rate * 1.2)
  // 5 000 * 1.2 = 6 000 FCFA
  assert.equal(calculateTaskAmount(5_000, true), 6_000);

  // 6 000 * 1.2 = 7 200 FCFA
  assert.equal(calculateTaskAmount(6_000, true), 7_200);

  // 1 600 * 1.2 = 1 920 FCFA
  assert.equal(calculateTaskAmount(1_600, true), 1_920);

  // Guards against non-positive
  assert.equal(calculateTaskAmount(0, true), 0);
  assert.equal(calculateTaskAmount(-1_000, false), 0);
});

test("Couture Sprint 6: Weekly payroll aggregation and net computation", () => {
  const weekTasks = [
    // 3 Agbada standard (5 000 x 3 = 15 000)
    { unitRateXof: 5_000, isOvertime: false, finalAmountXof: 5_000 },
    { unitRateXof: 5_000, isOvertime: false, finalAmountXof: 5_000 },
    { unitRateXof: 5_000, isOvertime: false, finalAmountXof: 5_000 },
    // 2 Agbada avec broderie hors-horaires (6 000 base + 1 200 majoration = 7 200 x 2 = 14 400)
    { unitRateXof: 6_000, isOvertime: true, finalAmountXof: 7_200 },
    { unitRateXof: 6_000, isOvertime: true, finalAmountXof: 7_200 },
    // 2 Haut Danshiki standard (2 000 x 2 = 4 000)
    { unitRateXof: 2_000, isOvertime: false, finalAmountXof: 2_000 },
    { unitRateXof: 2_000, isOvertime: false, finalAmountXof: 2_000 },
  ];
  // Total base = 15 000 + 12 000 + 4 000 = 31 000 FCFA
  // Total overtime extra = 2 x 1 200 = 2 400 FCFA
  // Total tasks = 33 400 FCFA
  // Bonus = 5 000 FCFA, Deduction = 2 000 FCFA
  // Net = 33 400 + 5 000 - 2 000 = 36 400 FCFA

  const totals = computeWeeklyPayrollTotals(weekTasks, 5_000, 2_000);

  assert.equal(totals.tasksCount, 7);
  assert.equal(totals.baseAmountXof, 31_000);
  assert.equal(totals.overtimeAmountXof, 2_400);
  assert.equal(totals.totalTasksAmountXof, 33_400);
  assert.equal(totals.bonusAmountXof, 5_000);
  assert.equal(totals.deductionAmountXof, 2_000);
  assert.equal(totals.netAmountXof, 36_400);
});

test("Couture Sprint 6: RBAC authorization on Piecework & Payroll", () => {
  const ouvrierPerms = new Set(defaultCoutureRolePermissions.OUVRIER);
  assert.ok(ouvrierPerms.has("piecework.view"), "Ouvrier can view piecework rates");
  assert.ok(ouvrierPerms.has("piecework.declare"), "Ouvrier can declare task completion");
  assert.equal(ouvrierPerms.has("piecework.manage"), false, "Ouvrier cannot modify the piecework barème");
  assert.equal(ouvrierPerms.has("payroll.calculate"), false, "Ouvrier cannot calculate global payroll");
  assert.equal(ouvrierPerms.has("payroll.approve"), false, "Ouvrier cannot approve payroll payments");

  const chefAtelierPerms = new Set(defaultCoutureRolePermissions.CHEF_ATELIER);
  assert.ok(chefAtelierPerms.has("piecework.view"));
  assert.ok(chefAtelierPerms.has("piecework.manage"), "Chef atelier can manage task rates");

  const comptablePerms = new Set(defaultCoutureRolePermissions.COMPTABLE);
  assert.ok(comptablePerms.has("payroll.view"));
  assert.ok(comptablePerms.has("payroll.calculate"), "Comptable calculates worker payroll");
  assert.equal(comptablePerms.has("payroll.approve"), false, "Comptable cannot self-approve payroll");

  const rhPerms = new Set(defaultCoutureRolePermissions.RH);
  assert.ok(rhPerms.has("payroll.view"));
  assert.ok(rhPerms.has("payroll.approve"), "Direction / RH approves and validates worker payroll");
});
