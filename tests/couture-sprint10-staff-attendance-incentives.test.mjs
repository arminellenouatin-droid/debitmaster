import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSaleIncentives,
  evaluateCustomerLoyaltyBonus,
  evaluateAnnualRewards,
  evaluateMonthlySellerAlert,
  verifySiteGeofence,
  detectAbsenceIncident,
  generateMonthlyPayrollNumber,
} from "../src/lib/couture-staff-incentives.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 10: Sequential numbering for Monthly Payrolls", () => {
  const pay1 = generateMonthlyPayrollNumber(1, 2026);
  assert.equal(pay1, "PAY-2026-000001");
  assert.match(pay1, /^PAY-\d{4}-\d{6}$/);

  const pay48 = generateMonthlyPayrollNumber(48, 2026);
  assert.equal(pay48, "PAY-2026-000048");
});

test("Couture Sprint 10: Sales points & High-ticket 2% bonus calculation", () => {
  // 1. Vente ordinaire (120 000 FCFA) -> 2 points (tranches de 50k), pas de gros achat
  const v1 = calculateSaleIncentives(120_000);
  assert.equal(v1.pointsEarned, 2);
  assert.equal(v1.isHighTicket, false);
  assert.equal(v1.highTicketBonusXof, 0);

  // 2. Vente 950 000 FCFA -> 19 points, seuil 1 000 000 non dépassé
  const v2 = calculateSaleIncentives(950_000);
  assert.equal(v2.pointsEarned, 19);
  assert.equal(v2.isHighTicket, false);
  assert.equal(v2.highTicketBonusXof, 0);

  // 3. Gros achat (> 1 000 000 FCFA) : 2 500 000 FCFA -> 50 points + prime de 2% (50 000 FCFA)
  const v3 = calculateSaleIncentives(2_500_000);
  assert.equal(v3.pointsEarned, 50);
  assert.equal(v3.isHighTicket, true);
  assert.equal(v3.highTicketBonusXof, 50_000); // 2 500 000 * 0.02
});

test("Couture Sprint 10: Customer loyalty quarterly bonus (2% if >= 4 orders or >= 2 orders and > 3.5M FCFA)", () => {
  // Condition 1 : au moins 4 commandes dans le trimestre (ex. 4 × 500 000 = 2 000 000 FCFA)
  const b1 = evaluateCustomerLoyaltyBonus(4, 2_000_000);
  assert.equal(b1.isEligible, true);
  assert.equal(b1.loyaltyBonusXof, 40_000); // 2 000 000 * 0.02

  // Condition 2 : 2 commandes mais total > 3 500 000 FCFA (ex. 2 × 2 000 000 = 4 000 000 FCFA)
  const b2 = evaluateCustomerLoyaltyBonus(2, 4_000_000);
  assert.equal(b2.isEligible, true);
  assert.equal(b2.loyaltyBonusXof, 80_000); // 4 000 000 * 0.02

  // Non éligible : 2 commandes totalisant 2 000 000 FCFA (< 3.5M et < 4 commandes)
  const b3 = evaluateCustomerLoyaltyBonus(2, 2_000_000);
  assert.equal(b3.isEligible, false);
  assert.equal(b3.loyaltyBonusXof, 0);
});

test("Couture Sprint 10: Annual rewards evaluation (Car vs Motorcycle with 3-year seniority guard)", () => {
  // 1. Vendeur 1 700 points + 3.5 ans d'ancienneté -> Voiture + bon 300 000 FCFA
  const r1 = evaluateAnnualRewards(1_700, 3.5);
  assert.equal(r1.tier, "CAR_AND_FUEL_BONUS_300K");
  assert.equal(r1.fuelVoucherXof, 300_000);
  assert.equal(r1.meetsSeniority, true);

  // 2. Vendeur 1 700 points mais seulement 1.5 ans d'ancienneté -> Pas de voiture (ancienneté requise)
  const r2 = evaluateAnnualRewards(1_700, 1.5);
  assert.equal(r2.tier, null);
  assert.equal(r2.meetsSeniority, false);

  // 3. Vendeur 1 000 points + 4 ans d'ancienneté -> Moto + bon 150 000 FCFA
  const r3 = evaluateAnnualRewards(1_000, 4.0);
  assert.equal(r3.tier, "MOTORCYCLE_AND_FUEL_BONUS_150K");
  assert.equal(r3.fuelVoucherXof, 150_000);
  assert.equal(r3.meetsSeniority, true);

  // 4. Vendeur 600 points + 5 ans d'ancienneté -> Palier non atteint
  const r4 = evaluateAnnualRewards(600, 5.0);
  assert.equal(r4.tier, null);
});

test("Couture Sprint 10: Monthly seller performance alerts (< 60 points threshold)", () => {
  // 1. Performance satisfaisante (>= 60 points) -> NONE
  const a1 = evaluateMonthlySellerAlert(75);
  assert.equal(a1.alertLevel, "NONE");

  // 2. Premier mois sous le seuil (45 points) -> LOW_PERFORMANCE_WARNING
  const a2 = evaluateMonthlySellerAlert(45);
  assert.equal(a2.alertLevel, "LOW_PERFORMANCE_WARNING");

  // 3. Deux mois consécutifs sous le seuil (50 points après 48 points) -> REINFORCED_PERFORMANCE_WARNING
  const a3 = evaluateMonthlySellerAlert(50, 48);
  assert.equal(a3.alertLevel, "REINFORCED_PERFORMANCE_WARNING");
});

test("Couture Sprint 10: Geolocation proximity & Absence incident detection (> 15 min)", () => {
  // Site Lomé Kodjoviakopé (6.1285, 1.2150)
  const siteLat = 6.1285;
  const siteLng = 1.2150;

  // Présent sur le site (distance 0m)
  const g1 = verifySiteGeofence(siteLat, siteLng, siteLat, siteLng, 200);
  assert.equal(g1.isWithinGeofence, true);
  assert.equal(g1.distanceMeters, 0);

  // Utilisateur à ~2 km (hors zone tolérée)
  const g2 = verifySiteGeofence(siteLat, siteLng, 6.1450, 1.2150, 200);
  assert.equal(g2.isWithinGeofence, false);
  assert.ok(g2.distanceMeters > 1000);

  // Absence tolérée <= 15 minutes
  const abs1 = detectAbsenceIncident(12);
  assert.equal(abs1.isIncident, false);
  assert.equal(abs1.shouldDisconnect, false);

  // Absence excessive > 15 minutes -> Incident & Déconnexion automatique
  const abs2 = detectAbsenceIncident(18);
  assert.equal(abs2.isIncident, true);
  assert.equal(abs2.shouldDisconnect, true);
});

test("Couture Sprint 10: RBAC authorization on Attendance, HR, Payroll and Incentives", () => {
  const rhPerms = new Set(defaultCoutureRolePermissions.RH);
  assert.ok(rhPerms.has("hr.view"), "RH can view HR dossiers");
  assert.ok(rhPerms.has("hr.manage"), "RH can manage schedules and HR");
  assert.ok(rhPerms.has("payroll.approve"), "RH can approve monthly payrolls");
  assert.ok(rhPerms.has("incentives.manage"), "RH can manage incentive thresholds");

  const chefAgencePerms = new Set(defaultCoutureRolePermissions.CHEF_AGENCE);
  assert.ok(chefAgencePerms.has("attendance.view"), "Chef d'agence views attendance");
  assert.ok(chefAgencePerms.has("attendance.track"), "Chef d'agence records attendance");
  assert.ok(chefAgencePerms.has("incentives.view"), "Chef d'agence views incentives");
  assert.equal(chefAgencePerms.has("payroll.approve"), false, "Chef d'agence cannot approve payrolls alone");

  const vendeurPerms = new Set(defaultCoutureRolePermissions.VENDEUR);
  assert.ok(vendeurPerms.has("attendance.track"), "Vendeur clocks in attendance");
  assert.ok(vendeurPerms.has("incentives.view"), "Vendeur sees points and leaderboard");
  assert.equal(vendeurPerms.has("hr.manage"), false, "Vendeur cannot manage HR schedules");
});
