import assert from "node:assert/strict";
import test from "node:test";
import {
  generateCoutureSaleNumber,
  calculateLineTotal,
  calculateSaleTotals,
  resolvePaymentStatus,
} from "../src/lib/couture-sales.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 3: Sequential sale number formatting", () => {
  const num1 = generateCoutureSaleNumber(1, 2026);
  assert.equal(num1, "VTE-2026-000001");

  const num42 = generateCoutureSaleNumber(42, 2026);
  assert.equal(num42, "VTE-2026-000042");

  const num999999 = generateCoutureSaleNumber(999999, 2026);
  assert.equal(num999999, "VTE-2026-999999");

  // Format regex check
  assert.match(num1, /^VTE-\d{4}-\d{6}$/);
  assert.match(num42, /^VTE-\d{4}-\d{6}$/);
});

test("Couture Sprint 3: Sale line totals calculation and guards", () => {
  // Standard valid line
  assert.equal(calculateLineTotal(2, 150_000), 300_000);
  assert.equal(calculateLineTotal(1, 500_000), 500_000);

  // Guards against non-positive quantity or negative price
  assert.equal(calculateLineTotal(0, 150_000), 0);
  assert.equal(calculateLineTotal(-3, 150_000), 0);
  assert.equal(calculateLineTotal(2, -50_000), 0);
  assert.equal(calculateLineTotal(1.5, 100_000), 0);
});

test("Couture Sprint 3: Sale totals calculation with discount and balance", () => {
  const lines = [
    { quantity: 1, unitPriceXof: 350_000 }, // Danshiki VIP
    { quantity: 2, unitPriceXof: 25_000 },  // 2 Accessoires (manchettes)
  ];
  // Subtotal: 350 000 + 50 000 = 400 000 FCFA

  // Case 1: No discount, no initial payment
  const totals1 = calculateSaleTotals(lines, 0, 0);
  assert.equal(totals1.subtotalAmountXof, 400_000);
  assert.equal(totals1.discountAmountXof, 0);
  assert.equal(totals1.totalAmountXof, 400_000);
  assert.equal(totals1.paidAmountXof, 0);
  assert.equal(totals1.balanceAmountXof, 400_000);

  // Case 2: Discount of 20 000 FCFA, 50% deposit (200 000 FCFA paid out of 380 000)
  const totals2 = calculateSaleTotals(lines, 20_000, 200_000);
  assert.equal(totals2.subtotalAmountXof, 400_000);
  assert.equal(totals2.discountAmountXof, 20_000);
  assert.equal(totals2.totalAmountXof, 380_000);
  assert.equal(totals2.paidAmountXof, 200_000);
  assert.equal(totals2.balanceAmountXof, 180_000);

  // Case 3: Discount exceeds subtotal -> capped at subtotal
  const totals3 = calculateSaleTotals(lines, 500_000, 0);
  assert.equal(totals3.discountAmountXof, 400_000);
  assert.equal(totals3.totalAmountXof, 0);
  assert.equal(totals3.balanceAmountXof, 0);
});

test("Couture Sprint 3: Payment status resolution lifecycle", () => {
  const total = 500_000;

  // Unpaid -> CONFIRMED
  assert.equal(resolvePaymentStatus(total, 0), "CONFIRMED");

  // Partial payment -> PARTIALLY_PAID
  assert.equal(resolvePaymentStatus(total, 150_000), "PARTIALLY_PAID");
  assert.equal(resolvePaymentStatus(total, 499_999), "PARTIALLY_PAID");

  // Fully paid -> PAID
  assert.equal(resolvePaymentStatus(total, 500_000), "PAID");
  assert.equal(resolvePaymentStatus(total, 600_000), "PAID"); // Overpaid / cash change
});

test("Couture Sprint 3: Distinct workflows for 4 sale types", () => {
  // 1. VENTE_SIMPLE: Vente directe produit fini en boutique
  const venteSimpleLines = [
    {
      itemType: "CLOTHING",
      description: "Agbada Royale L Homme",
      quantity: 1,
      unitPriceXof: 700_000,
      fabricProvidedByCustomer: false,
    },
  ];
  const venteSimple = calculateSaleTotals(venteSimpleLines, 0, 700_000);
  assert.equal(venteSimple.totalAmountXof, 700_000);
  assert.equal(resolvePaymentStatus(venteSimple.totalAmountXof, venteSimple.paidAmountXof), "PAID");

  // 2. COMMANDE: Vêtement sur mesure avec acompte de réservation 50%
  const commandeLines = [
    {
      itemType: "CLOTHING",
      description: "Boubou Présidentiel Sur-mesure",
      quantity: 1,
      unitPriceXof: 500_000,
      fabricProvidedByCustomer: false,
    },
  ];
  const commande = calculateSaleTotals(commandeLines, 0, 250_000);
  assert.equal(commande.balanceAmountXof, 250_000);
  assert.equal(resolvePaymentStatus(commande.totalAmountXof, commande.paidAmountXof), "PARTIALLY_PAID");

  // 3. CONFECTION: Client fournit son tissu -> Façon uniquement facturée
  const confectionLines = [
    {
      itemType: "CONFECTION_LABOR",
      description: "Confection façon veste Goodluck VIP - tissu client fourni",
      quantity: 1,
      unitPriceXof: 75_000, // Façon seule
      fabricProvidedByCustomer: true,
    },
  ];
  const confection = calculateSaleTotals(confectionLines, 0, 75_000);
  assert.equal(confection.totalAmountXof, 75_000);
  assert.equal(resolvePaymentStatus(confection.totalAmountXof, confection.paidAmountXof), "PAID");

  // 4. RETOUCHE: Prestation de retouche sur vêtement
  const retoucheLines = [
    {
      itemType: "ALTERATION_SERVICE",
      description: "Ourlet pantalon et cintrage taille",
      quantity: 1,
      unitPriceXof: 15_000,
      fabricProvidedByCustomer: false,
    },
  ];
  const retouche = calculateSaleTotals(retoucheLines, 0, 15_000);
  assert.equal(retouche.totalAmountXof, 15_000);
  assert.equal(resolvePaymentStatus(retouche.totalAmountXof, retouche.paidAmountXof), "PAID");
});

test("Couture Sprint 3: RBAC authorization on Sales & Orders", () => {
  const vendeurPerms = new Set(defaultCoutureRolePermissions.VENDEUR);
  assert.ok(vendeurPerms.has("sales.view"), "Vendeur can view sales");
  assert.ok(vendeurPerms.has("sales.create"), "Vendeur can create sales");

  const chefAgencePerms = new Set(defaultCoutureRolePermissions.CHEF_AGENCE);
  assert.ok(chefAgencePerms.has("sales.view"));
  assert.ok(chefAgencePerms.has("sales.create"));

  const ouvrierPerms = new Set(defaultCoutureRolePermissions.OUVRIER);
  assert.equal(ouvrierPerms.has("sales.view"), false, "Ouvrier cannot view retail sales");
  assert.equal(ouvrierPerms.has("sales.create"), false, "Ouvrier cannot create retail sales");

  const comptablePerms = new Set(defaultCoutureRolePermissions.COMPTABLE);
  assert.ok(comptablePerms.has("sales.view"), "Comptable can view sales for accounting reconciliation");
  assert.equal(comptablePerms.has("sales.create"), false, "Comptable does not register boutique sales directly");
});
