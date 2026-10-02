export type CoutureCurrency = "FCFA" | "USD" | "EUR";

export type CoutureExchangeRates = {
  eurToFcfa: number;
  usdToFcfa: number;
  effectiveDate: string;
};

export const defaultExchangeRates: CoutureExchangeRates = {
  eurToFcfa: 655.957, // Taux officiel fixe zone franc
  usdToFcfa: 600.0,   // Taux de référence marché
  effectiveDate: new Date().toISOString().slice(0, 10),
};

/**
 * Convertit un montant FCFA vers une autre devise avec arrondi standard (2 décimales pour USD/EUR).
 */
export function convertFcfaToCurrency(
  amountFcfa: number,
  targetCurrency: CoutureCurrency,
  rates: CoutureExchangeRates = defaultExchangeRates
): number {
  if (!Number.isFinite(amountFcfa) || amountFcfa <= 0) return 0;
  if (targetCurrency === "FCFA") return Math.round(amountFcfa);

  if (targetCurrency === "EUR") {
    if (rates.eurToFcfa <= 0) return 0;
    return Math.round((amountFcfa / rates.eurToFcfa) * 100) / 100;
  }

  if (targetCurrency === "USD") {
    if (rates.usdToFcfa <= 0) return 0;
    return Math.round((amountFcfa / rates.usdToFcfa) * 100) / 100;
  }

  return 0;
}

/**
 * Convertit un montant en devise étrangère (USD ou EUR) en équivalent FCFA (entier sans décimale).
 */
export function convertCurrencyToFcfa(
  amount: number,
  sourceCurrency: CoutureCurrency,
  rates: CoutureExchangeRates = defaultExchangeRates
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (sourceCurrency === "FCFA") return Math.round(amount);

  if (sourceCurrency === "EUR") {
    return Math.round(amount * rates.eurToFcfa);
  }

  if (sourceCurrency === "USD") {
    return Math.round(amount * rates.usdToFcfa);
  }

  return 0;
}

export type MultiCurrencyCashInput = {
  fcfa?: number;
  usd?: number;
  eur?: number;
};

export type OtherPaymentInput = {
  method: "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER";
  amountFcfa: number;
  mobileMoneyPhone?: string | null;
  mobileMoneyProvider?: "MTN" | "MOOV" | "ORANGE" | "WAVE" | null;
  tpeReference?: string | null;
  bankReference?: string | null;
};

export type MultiCurrencyCheckoutResult = {
  totalDueFcfa: number;
  cashFcfaInput: number;
  cashUsdInput: number;
  cashEurInput: number;
  cashUsdInFcfa: number;
  cashEurInFcfa: number;
  totalCashInFcfa: number;
  otherPaymentsTotalFcfa: number;
  totalPaidFcfa: number;
  balanceDueFcfa: number;
  changeDueFcfa: number;
  isFullyPaid: boolean;
  displayTotal: {
    fcfa: number;
    usd: number;
    eur: number;
  };
  displayBalance: {
    fcfa: number;
    usd: number;
    eur: number;
  };
  displayChange: {
    fcfa: number;
    usd: number;
    eur: number;
  };
  validationErrors: string[];
};

/**
 * Calcule l'encaissement multidevise comptoir (espèces FCFA + USD + EUR)
 * combinable avec Mobile Money et TPE/Carte.
 */
export function calculateMultiCurrencyCheckout(
  totalDueFcfa: number,
  cash: MultiCurrencyCashInput = {},
  otherPayments: OtherPaymentInput[] = [],
  rates: CoutureExchangeRates = defaultExchangeRates
): MultiCurrencyCheckoutResult {
  const errors: string[] = [];

  const dueFcfa = Math.max(0, Math.round(totalDueFcfa));
  const rawCashFcfa = Math.max(0, Math.floor(cash.fcfa || 0));
  const rawCashUsd = Math.max(0, Number(cash.usd) || 0);
  const rawCashEur = Math.max(0, Number(cash.eur) || 0);

  const cashUsdInFcfa = convertCurrencyToFcfa(rawCashUsd, "USD", rates);
  const cashEurInFcfa = convertCurrencyToFcfa(rawCashEur, "EUR", rates);
  const totalCashInFcfa = rawCashFcfa + cashUsdInFcfa + cashEurInFcfa;

  // Calcul des autres modes de règlement (devise locale obligatoire = FCFA)
  let hasMobileMoney = false;
  let hasTpe = false;
  let otherPaymentsTotal = 0;

  for (const p of otherPayments) {
    const amt = Math.max(0, Math.floor(p.amountFcfa || 0));
    otherPaymentsTotal += amt;

    if (p.method === "MOBILE_MONEY") {
      hasMobileMoney = true;
      if (!p.mobileMoneyPhone || p.mobileMoneyPhone.trim().length < 8) {
        errors.push("Numéro de téléphone requis pour le règlement Mobile Money.");
      }
    }

    if (p.method === "CARD") {
      hasTpe = true;
      if (!p.tpeReference || p.tpeReference.trim().length < 2) {
        errors.push("Référence de transaction TPE obligatoire.");
      }
    }
  }

  // Règle d'ordonnancement métier PRD 6.4:
  // Si mobile money ET TPE sont utilisés sur la même facture, Mobile Money est déclenché en premier
  if (hasMobileMoney && hasTpe) {
    // Vérification de séquence
    const mmIndex = otherPayments.findIndex((p) => p.method === "MOBILE_MONEY");
    const tpeIndex = otherPayments.findIndex((p) => p.method === "CARD");
    if (tpeIndex >= 0 && mmIndex > tpeIndex) {
      errors.push("Séquence obligatoire : le règlement Mobile Money doit être validé avant le règlement TPE.");
    }
  }

  const totalPaid = totalCashInFcfa + otherPaymentsTotal;
  const balanceDue = Math.max(0, dueFcfa - totalPaid);
  const changeDue = Math.max(0, totalPaid - dueFcfa);
  const isFullyPaid = totalPaid >= dueFcfa && dueFcfa > 0;

  return {
    totalDueFcfa: dueFcfa,
    cashFcfaInput: rawCashFcfa,
    cashUsdInput: rawCashUsd,
    cashEurInput: rawCashEur,
    cashUsdInFcfa,
    cashEurInFcfa,
    totalCashInFcfa,
    otherPaymentsTotalFcfa: otherPaymentsTotal,
    totalPaidFcfa: totalPaid,
    balanceDueFcfa: balanceDue,
    changeDueFcfa: changeDue,
    isFullyPaid,
    displayTotal: {
      fcfa: dueFcfa,
      usd: convertFcfaToCurrency(dueFcfa, "USD", rates),
      eur: convertFcfaToCurrency(dueFcfa, "EUR", rates),
    },
    displayBalance: {
      fcfa: balanceDue,
      usd: convertFcfaToCurrency(balanceDue, "USD", rates),
      eur: convertFcfaToCurrency(balanceDue, "EUR", rates),
    },
    displayChange: {
      fcfa: changeDue,
      usd: convertFcfaToCurrency(changeDue, "USD", rates),
      eur: convertFcfaToCurrency(changeDue, "EUR", rates),
    },
    validationErrors: errors,
  };
}
