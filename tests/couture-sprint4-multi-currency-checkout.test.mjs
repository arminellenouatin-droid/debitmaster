import assert from "node:assert/strict";
import test from "node:test";
import {
  convertFcfaToCurrency,
  convertCurrencyToFcfa,
  calculateMultiCurrencyCheckout,
  defaultExchangeRates,
} from "../src/lib/couture-multi-currency.ts";
import { defaultCoutureRolePermissions } from "../src/lib/couture-permissions.ts";

test("Couture Sprint 4: Currency conversions and rounding rules", () => {
  const rates = {
    eurToFcfa: 655.957,
    usdToFcfa: 600.0,
    effectiveDate: "2026-10-02",
  };

  // 150 000 FCFA en EUR: 150 000 / 655.957 = 228.67 EUR
  assert.equal(convertFcfaToCurrency(150_000, "EUR", rates), 228.67);

  // 150 000 FCFA en USD: 150 000 / 600 = 250.00 USD
  assert.equal(convertFcfaToCurrency(150_000, "USD", rates), 250.0);

  // 350 000 FCFA en EUR: 350 000 / 655.957 = 533.57 EUR
  assert.equal(convertFcfaToCurrency(350_000, "EUR", rates), 533.57);

  // Reconversion EUR vers FCFA: 100 EUR = 65 596 FCFA
  assert.equal(convertCurrencyToFcfa(100, "EUR", rates), 65_596);

  // Reconversion USD vers FCFA: 150 USD = 90 000 FCFA
  assert.equal(convertCurrencyToFcfa(150, "USD", rates), 90_000);
});

test("Couture Sprint 4: Simultaneous 3-currency cash counter checkout", () => {
  const totalDue = 350_000; // Facture de 350 000 FCFA

  // Le client paie simultanément en espèces au comptoir :
  // - 100 000 FCFA
  // - 200 USD (à 600 FCFA/USD = 120 000 FCFA)
  // - 200 EUR (à 655.957 FCFA/EUR = 131 191 FCFA)
  // Total espèces = 100 000 + 120 000 + 131 191 = 351 191 FCFA
  const res = calculateMultiCurrencyCheckout(
    totalDue,
    { fcfa: 100_000, usd: 200, eur: 200 },
    []
  );

  assert.equal(res.totalDueFcfa, 350_000);
  assert.equal(res.cashFcfaInput, 100_000);
  assert.equal(res.cashUsdInFcfa, 120_000);
  assert.equal(res.cashEurInFcfa, 131_191);
  assert.equal(res.totalCashInFcfa, 351_191);
  assert.equal(res.totalPaidFcfa, 351_191);
  assert.equal(res.balanceDueFcfa, 0);
  assert.equal(res.changeDueFcfa, 1_191); // Rendu monnaie
  assert.equal(res.isFullyPaid, true);
  assert.equal(res.validationErrors.length, 0);
});

test("Couture Sprint 4: Mixed payment (Cash multi-devise + Mobile Money + TPE)", () => {
  const totalDue = 500_000;

  // Paiement combiné :
  // - Espèces : 50 000 FCFA + 100 USD (60 000 FCFA) = 110 000 FCFA
  // - Mobile Money MTN : 250 000 FCFA
  // - Carte bancaire TPE : 140 000 FCFA
  // Total = 500 000 FCFA pile
  const otherPayments = [
    {
      method: "MOBILE_MONEY",
      amountFcfa: 250_000,
      mobileMoneyPhone: "+22890112233",
      mobileMoneyProvider: "MTN",
    },
    {
      method: "CARD",
      amountFcfa: 140_000,
      tpeReference: "TPE-LOME-98765",
    },
  ];

  const res = calculateMultiCurrencyCheckout(
    totalDue,
    { fcfa: 50_000, usd: 100 },
    otherPayments
  );

  assert.equal(res.totalPaidFcfa, 500_000);
  assert.equal(res.balanceDueFcfa, 0);
  assert.equal(res.changeDueFcfa, 0);
  assert.equal(res.isFullyPaid, true);
  assert.equal(res.validationErrors.length, 0);
});

test("Couture Sprint 4: Sequential enforcement - Mobile Money must be processed before TPE", () => {
  const totalDue = 300_000;

  // Violation de séquence : TPE listé avant Mobile Money
  const invalidSequencePayments = [
    {
      method: "CARD",
      amountFcfa: 100_000,
      tpeReference: "TPE-001",
    },
    {
      method: "MOBILE_MONEY",
      amountFcfa: 200_000,
      mobileMoneyPhone: "+22890112233",
      mobileMoneyProvider: "MTN",
    },
  ];

  const res = calculateMultiCurrencyCheckout(
    totalDue,
    {},
    invalidSequencePayments
  );

  assert.ok(res.validationErrors.length > 0);
  assert.ok(
    res.validationErrors[0].includes("Mobile Money doit être validé avant le règlement TPE")
  );
});

test("Couture Sprint 4: RBAC authorization on Multi-Currency Counter checkout", () => {
  const vendeurPerms = new Set(defaultCoutureRolePermissions.VENDEUR);
  assert.ok(vendeurPerms.has("sales.multi_currency"), "Vendeur can perform multi-currency checkout at counter");

  const chefAgencePerms = new Set(defaultCoutureRolePermissions.CHEF_AGENCE);
  assert.ok(chefAgencePerms.has("sales.multi_currency"));

  const dirPerms = new Set(defaultCoutureRolePermissions.DIRECTEUR_GERANT);
  assert.ok(dirPerms.has("sales.multi_currency"));

  const ouvrierPerms = new Set(defaultCoutureRolePermissions.OUVRIER);
  assert.equal(ouvrierPerms.has("sales.multi_currency"), false, "Ouvrier cannot cash payments");

  const magasinierPerms = new Set(defaultCoutureRolePermissions.MAGASINIER_ATELIER);
  assert.equal(magasinierPerms.has("sales.multi_currency"), false, "Magasinier atelier cannot cash sales");
});
