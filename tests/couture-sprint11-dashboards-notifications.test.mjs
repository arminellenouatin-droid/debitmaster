import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateParetoAbcClassification,
  buildCoutureNotification,
} from "../src/lib/couture-analytics.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 11: Pareto ABC Analytical Classification (80% / 15% / 5%)", () => {
  // 1. Liste de produits avec chiffres d'affaires
  // Total = 10 000 000 FCFA
  const items = [
    { id: "p1", label: "Agbada Présidentiel", revenueXof: 5_000_000 }, // 50% -> A
    { id: "p2", label: "Danshiki Royale", revenueXof: 3_000_000 },    // 30% -> cumul 80% -> A
    { id: "p3", label: "Goodluck VIP", revenueXof: 1_500_000 },       // 15% -> cumul 95% -> B
    { id: "p4", label: "Chapeau Traditionnel", revenueXof: 500_000 }, // 5% -> cumul 100% -> C
  ];

  const report = calculateParetoAbcClassification(items);

  assert.equal(report.totalRevenueXof, 10_000_000);
  assert.equal(report.itemsCount, 4);
  assert.equal(report.classACount, 2, "Les 2 premiers produits génèrent 80% du CA");
  assert.equal(report.classBCount, 1, "Le 3ème produit génère 15% du CA");
  assert.equal(report.classCCount, 1, "Le dernier produit génère les 5% restants");

  assert.equal(report.items[0].classification, "A");
  assert.equal(report.items[1].classification, "A");
  assert.equal(report.items[2].classification, "B");
  assert.equal(report.items[3].classification, "C");

  // 2. Cas liste vide
  const emptyReport = calculateParetoAbcClassification([]);
  assert.equal(emptyReport.totalRevenueXof, 0);
  assert.equal(emptyReport.itemsCount, 0);
});

test("Couture Sprint 11: Notification builder and validation", () => {
  const notif = buildCoutureNotification({
    category: "PURCHASE_APPROVAL",
    title: "Demande d'achat tissu soie > 50 000 FCFA",
    message: "Le chargé des achats et le comptable ont validé la demande DA-2026-000005. Accord Direction requis.",
    severity: "URGENT",
    recipientRole: "RH",
    linkUrl: "/dashboard/purchases/requests/5",
  });

  assert.equal(notif.category, "PURCHASE_APPROVAL");
  assert.equal(notif.severity, "URGENT");
  assert.equal(notif.recipientRole, "RH");
  assert.ok(notif.title.includes("50 000 FCFA"));
  assert.equal(notif.linkUrl, "/dashboard/purchases/requests/5");

  // Test avec sévérité par défaut (INFO)
  const defaultNotif = buildCoutureNotification({
    category: "LOW_STOCK",
    title: "Stock bouton nacre bas",
    message: "Seuil critique atteint.",
  });
  assert.equal(defaultNotif.severity, "INFO");
});

test("Couture Sprint 11: RBAC authorization on Dashboards, Reports & Exports", () => {
  const dirGerantPerms = new Set(defaultCoutureRolePermissions.DIRECTEUR_GERANT);
  assert.ok(dirGerantPerms.has("dashboard.view"), "Direction can view cockpit dashboard");
  assert.ok(dirGerantPerms.has("reports.view"), "Direction can view reports");
  assert.ok(dirGerantPerms.has("reports.export"), "Direction can export analytical reports");

  const comptablePerms = new Set(defaultCoutureRolePermissions.COMPTABLE);
  assert.ok(comptablePerms.has("dashboard.view"), "Comptable views dashboard");
  assert.ok(comptablePerms.has("reports.view"), "Comptable views financial reports");
  assert.ok(comptablePerms.has("reports.export"), "Comptable can export financial data");

  const chefAtelierPerms = new Set(defaultCoutureRolePermissions.CHEF_ATELIER);
  assert.ok(chefAtelierPerms.has("dashboard.view"), "Chef d'atelier views workshop dashboard");
  assert.ok(chefAtelierPerms.has("reports.view"), "Chef d'atelier views production reports");
  assert.equal(chefAtelierPerms.has("reports.export"), false, "Chef d'atelier cannot export financial reports");

  const ouvrierPerms = new Set(defaultCoutureRolePermissions.OUVRIER);
  assert.ok(ouvrierPerms.has("dashboard.view"), "Ouvrier has access to his personal task dashboard");
  assert.equal(ouvrierPerms.has("reports.view"), false, "Ouvrier cannot view global reports");
});
