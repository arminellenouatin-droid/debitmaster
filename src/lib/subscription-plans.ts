// ==============================================================================
// DebitMaster SaaS — Système d'abonnement & tarification (PRD v1.1)
// 6 activités indépendantes, tarif mensuel propre, réduction annuelle de 25 %,
// option spéciale à +50 % (×1,5).
// ==============================================================================

export const subscriptionActivityCodes = [
  "BUVETTE",
  "BAR_RESTAURANT",
  "NIGHTCLUB_LOUNGE",
  "HOTEL_AUBERGE",
  "BOUTIQUE_COMMERCE",
  "ATELIER_COUTURE",
] as const;

export type SubscriptionActivityCode = (typeof subscriptionActivityCodes)[number];

export const billingPeriodCodes = ["MONTHLY", "ANNUAL"] as const;
export type BillingPeriod = (typeof billingPeriodCodes)[number];

export const planLevelCodes = ["NORMAL", "SPECIAL"] as const;
export type PlanLevel = (typeof planLevelCodes)[number];

// Codes de plans unifiés (Normal et Option spéciale par activité)
export const subscriptionPlanCodes = [
  "BUVETTE",
  "BUVETTE_SPECIAL",
  "BAR_RESTAURANT",
  "BAR_RESTAURANT_SPECIAL",
  "NIGHTCLUB_LOUNGE",
  "NIGHTCLUB_LOUNGE_SPECIAL",
  "HOTEL_AUBERGE",
  "HOTEL_AUBERGE_SPECIAL",
  "BOUTIQUE_COMMERCE",
  "BOUTIQUE_COMMERCE_SPECIAL",
  "ATELIER_COUTURE",
  "ATELIER_COUTURE_SPECIAL",
] as const;

export type SubscriptionPlanCode = (typeof subscriptionPlanCodes)[number];

export const freeTrialDays = 30;
export const defaultAnnualDiscountRate = 0.25; // 25 % d'économie (taux multiplicateur 0,75)
export const defaultSpecialMultiplier = 1.5; // +50 % (facteur 1,5)

export interface ActivityPricingConfig {
  code: SubscriptionActivityCode;
  label: string;
  tagline: string;
  monthlyNormalPriceXof: number;
  specialMultiplier: number;
  annualDiscountRate: number;
  annualNormalOverride?: number | null;
  annualSpecialOverride?: number | null;
  isAvailable: boolean;
  normalFeatures: string[];
  specialFeatures: string[];
  specialDescription: string;
}

export type SubscriptionPriceOverride = {
  activity_code: string;
  plan_code: string;
  billing_period?: string | null;
  price_xof: number;
  description?: string | null;
};

// Grille de référence officielle PRD v1.1 (Section 2)
export const referenceActivityConfigs: Record<SubscriptionActivityCode, ActivityPricingConfig> = {
  BUVETTE: {
    code: "BUVETTE",
    label: "Buvette",
    tagline: "Maquis, dépôts et vente de boissons uniquement.",
    monthlyNormalPriceXof: 30_000,
    specialMultiplier: 1.5,
    annualDiscountRate: 0.25,
    isAvailable: true,
    normalFeatures: [
      "Vente de boissons uniquement (anti-coulage & casiers)",
      "Jusqu'à 5 serveuses connectées",
      "1 seul magasin de stock de boissons",
      "Jusqu'à 15 tables de service",
      "Commandes serveuse -> préparation gérant -> livraison",
      "Points et versements journaliers des serveuses au gérant",
      "Stocks d'alerte et bons d'approvisionnement (visa promoteur)",
      "Contrôle journalier des stocks et inventaires physiques",
    ],
    specialFeatures: [
      "Serveuses illimitées",
      "Tables de service illimitées",
      "Magasins de stock illimités",
      "Commandes autonomes par QR Code sur table",
      "Module & sessions de Comptabilité",
      "Module Trésorerie et Immobilisations",
    ],
    specialDescription:
      "Option spéciale Buvette : serveuses, tables et magasins illimités, commande autonome par QR Code sur table, sessions de comptabilité et trésorerie/immobilisations.",
  },
  BAR_RESTAURANT: {
    code: "BAR_RESTAURANT",
    label: "Bar et restaurant",
    tagline: "Bars, maquis et restaurants avec salle, bar et cuisine.",
    monthlyNormalPriceXof: 50_000,
    specialMultiplier: 1.5,
    annualDiscountRate: 0.25,
    isAvailable: true,
    normalFeatures: [
      "Vente de boissons & gestion des stocks",
      "Prise de commande mobile serveuses",
      "Écran KDS cuisine en temps réel",
      "Gestion des repas & ingrédients",
      "Plan de salle & gestion des tables",
      "Encaissements MTN MoMo & espèces",
    ],
    specialFeatures: [
      "Module Repas et Cuisine KDS avancée",
      "Module Lavage Auto & Moto",
      "Module Gym, Fitness & Abonnements",
      "Module Auberge & Chambres (passe / nuitée)",
      "Générateur et gestion des tickets Wi-Fi",
      "Mode de paiement MTN MoMo Personnel dédié",
    ],
    specialDescription:
      "Option spéciale Bar et restaurant : inclut l’ensemble des modules avancés (repas/cuisine KDS, gym, lavage, auberge, Wi-Fi, MTN MoMo dédié).",
  },
  NIGHTCLUB_LOUNGE: {
    code: "NIGHTCLUB_LOUNGE",
    label: "Lounge et night-club",
    tagline: "Clubs, discothèques, rooftops et lounges à forte cadence.",
    monthlyNormalPriceXof: 75_000,
    specialMultiplier: 1.5,
    annualDiscountRate: 0.25,
    isAvailable: true,
    normalFeatures: [
      "Commandes ultra-rapides au verre et à la bouteille",
      "Gestion VIP et espaces réservés",
      "Contrôle strict des entrées et du vestiaire",
      "Réconciliation caisse & stocks en temps réel",
      "Alertes anti-coulage nocturne",
    ],
    specialFeatures: [
      "Gestion VIP premium et réservations exclusives (à définir)",
    ],
    specialDescription: "Option spéciale Lounge et night-club : gestion VIP et réservations exclusives.",
  },
  HOTEL_AUBERGE: {
    code: "HOTEL_AUBERGE",
    label: "Hôtel et auberge",
    tagline: "Hôtels, auberges, résidences et complexes d’hébergement.",
    monthlyNormalPriceXof: 80_000,
    specialMultiplier: 1.5,
    annualDiscountRate: 0.25,
    isAvailable: true,
    normalFeatures: [
      "Gestion des chambres (nuitées, demi-journées, passes)",
      "Planning des arrivées et départs",
      "Facturation hébergement & bar/restaurant liée",
      "Gouvernance et entretien ménager des chambres",
      "Registre des fiches de police / clients",
    ],
    specialFeatures: [
      "Services hôteliers étendus & multi-bâtiments (à définir)",
    ],
    specialDescription: "Option spéciale Hôtel et auberge : prestations hôtelières et bien-être étendues.",
  },
  BOUTIQUE_COMMERCE: {
    code: "BOUTIQUE_COMMERCE",
    label: "Boutique et commerce",
    tagline: "Négoce, commerce de détail, demi-gros et magasins.",
    monthlyNormalPriceXof: 50_000,
    specialMultiplier: 1.5,
    annualDiscountRate: 0.25,
    isAvailable: true,
    normalFeatures: [
      "Multi-magasins et inventaire physique",
      "Codes-barres et conditionnements multiples",
      "Devis, bons de commande et factures proformas",
      "Factures conformes et bons de livraison",
      "Sessions de caisse & clôture Z",
      "Comptabilité SYSCOHADA intégrée",
    ],
    specialFeatures: [
      "Extensions multi-dépôts & interconnexions B2B (à définir)",
    ],
    specialDescription: "Option spéciale Boutique et commerce : multi-dépôts étendus et e-commerce B2B.",
  },
  ATELIER_COUTURE: {
    code: "ATELIER_COUTURE",
    label: "Atelier de couture",
    tagline: "Maisons de couture, confection sur mesure et ateliers de production.",
    monthlyNormalPriceXof: 100_000,
    specialMultiplier: 1.5,
    annualDiscountRate: 0.25,
    isAvailable: true,
    normalFeatures: [
      "Prêt-à-porter et confection sur-mesure",
      "Fiches de mesures morphologiques complètes",
      "Workflow d’atelier (Coupe, Couture, Broderie, QC)",
      "Paie des ouvriers à la tâche avec majorations",
      "Multi-sites ateliers et boutiques",
      "Stocks de fournitures & tissus avec métrages",
    ],
    specialFeatures: [
      "Haute confection, lignes exclusives & réseau international (à définir)",
    ],
    specialDescription: "Option spéciale Atelier de couture : confection prestige et réseau d'ateliers exclusifs.",
  },
};

// Fonctions de calcul certifiées conformes au PRD v1.1
export function calculateAnnualPrice(monthlyPrice: number, discountRate = defaultAnnualDiscountRate): number {
  return Math.round(monthlyPrice * 12 * (1 - discountRate));
}

export function calculateSpecialPrice(normalPrice: number, multiplier = defaultSpecialMultiplier): number {
  return Math.round(normalPrice * multiplier);
}

export function normalizePeriod(period: string | null | undefined): BillingPeriod {
  return String(period ?? "MONTHLY").toUpperCase() === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

export function normalizeActivityCode(type: string | null | undefined): SubscriptionActivityCode {
  const norm = String(type ?? "").toUpperCase().trim();
  if (norm === "POWER" || norm === "RESTAURANT") return "BAR_RESTAURANT";
  if (norm === "BAR") return "BUVETTE";
  if (norm === "HOTELS") return "HOTEL_AUBERGE";
  if (subscriptionActivityCodes.includes(norm as SubscriptionActivityCode)) {
    return norm as SubscriptionActivityCode;
  }
  return "BAR_RESTAURANT";
}

export function isLegacyActivityCode(value: string): boolean {
  const norm = normalizeActivityCode(value);
  return norm !== "BOUTIQUE_COMMERCE" && norm !== "ATELIER_COUTURE";
}

export function parsePlanCode(planCode: string): { activity: SubscriptionActivityCode; isSpecial: boolean } {
  const clean = planCode.toUpperCase().trim();
  const isSpecial = clean.endsWith("_SPECIAL") || clean.includes("SPECIAL") || clean === "PRESTIGE";
  const activityPart = clean.replace(/_SPECIAL$/, "").replace(/_ANNUAL$/, "");
  return {
    activity: normalizeActivityCode(activityPart),
    isSpecial,
  };
}

export function getActivityPricing(activityType: string): ActivityPricingConfig {
  const code = normalizeActivityCode(activityType);
  return referenceActivityConfigs[code] ?? referenceActivityConfigs.BAR_RESTAURANT;
}

export function getSubscriptionPlan(planCode: string) {
  const { activity, isSpecial } = parsePlanCode(planCode);
  const config = referenceActivityConfigs[activity];
  if (!config) return null;

  const monthlyPriceXof = isSpecial
    ? calculateSpecialPrice(config.monthlyNormalPriceXof, config.specialMultiplier)
    : config.monthlyNormalPriceXof;
  const annualPriceXof = calculateAnnualPrice(monthlyPriceXof, config.annualDiscountRate);

  return {
    code: `${activity}${isSpecial ? "_SPECIAL" : ""}`,
    activity: config.code,
    label: `${config.label}${isSpecial ? " (Option spéciale)" : ""}`,
    isSpecial,
    monthlyPriceXof,
    annualPriceXof,
    description: isSpecial ? config.specialDescription : config.tagline,
    features: isSpecial ? [...config.normalFeatures, ...config.specialFeatures] : config.normalFeatures,
    quoteRequired: false,
  };
}

export function getSubscriptionFeatures(planCode: string): string[] {
  return getSubscriptionPlan(planCode)?.features ?? [];
}

export function isQuoteRequired(_plan: string): boolean {
  return false;
}

export function addSubscriptionPeriod(start: Date, billingPeriod: BillingPeriod = "MONTHLY"): Date {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + (billingPeriod === "ANNUAL" ? 12 : 1));
  return end;
}

export function getSubscriptionPrice(
  activityType: string,
  planOrLevel: string,
  billingPeriod: BillingPeriod = "MONTHLY",
  overrides: readonly SubscriptionPriceOverride[] = []
): number | null {
  const activity = normalizeActivityCode(activityType);
  const normalizedPeriod = normalizePeriod(billingPeriod);
  const isSpecial =
    planOrLevel === "SPECIAL" ||
    planOrLevel.toUpperCase().endsWith("_SPECIAL") ||
    planOrLevel.toUpperCase() === "PRESTIGE";

  // Check overrides first
  const planKey = `${activity}${isSpecial ? "_SPECIAL" : ""}`;
  const override = overrides.find(
    (o) =>
      o.activity_code.toUpperCase() === activity &&
      (o.plan_code.toUpperCase() === planKey || o.plan_code.toUpperCase() === planOrLevel.toUpperCase()) &&
      normalizePeriod(o.billing_period) === normalizedPeriod
  );
  if (override && Number.isSafeInteger(override.price_xof) && override.price_xof > 0) {
    return override.price_xof;
  }

  // Isolation check: if a specific plan code is requested for another activity, return null
  const requestedCode = planOrLevel.toUpperCase().replace(/_SPECIAL$/, "");
  if (
    subscriptionActivityCodes.includes(requestedCode as SubscriptionActivityCode) &&
    requestedCode !== activity
  ) {
    return null;
  }

  const config = referenceActivityConfigs[activity];
  if (!config) return null;

  const monthlyPrice = isSpecial
    ? calculateSpecialPrice(config.monthlyNormalPriceXof, config.specialMultiplier)
    : config.monthlyNormalPriceXof;

  if (normalizedPeriod === "ANNUAL") {
    if (isSpecial && config.annualSpecialOverride) return config.annualSpecialOverride;
    if (!isSpecial && config.annualNormalOverride) return config.annualNormalOverride;
    return calculateAnnualPrice(monthlyPrice, config.annualDiscountRate);
  }

  return monthlyPrice;
}

export interface PlanItem {
  code: string;
  activity: SubscriptionActivityCode;
  label: string;
  isSpecial: boolean;
  billingPeriod: BillingPeriod;
  durationMonths: number;
  priceXof: number;
  basePriceXof: number;
  monthlyPriceXof: number;
  savingsXof: number;
  discountPercent: number;
  description: string;
  features: string[];
  quoteRequired: boolean;
}

export function getSubscriptionCatalog(
  activityType: string,
  overrides: readonly SubscriptionPriceOverride[] = [],
  billingPeriod: BillingPeriod = "MONTHLY"
): PlanItem[] {
  const activity = normalizeActivityCode(activityType);
  const config = referenceActivityConfigs[activity];
  const period = normalizePeriod(billingPeriod);

  return [false, true].map((isSpecial) => {
    const code = `${activity}${isSpecial ? "_SPECIAL" : ""}`;
    const monthlyNormal = config.monthlyNormalPriceXof;
    const monthlyPrice = isSpecial
      ? calculateSpecialPrice(monthlyNormal, config.specialMultiplier)
      : monthlyNormal;

    const normalPriceCalculated =
      period === "ANNUAL"
        ? calculateAnnualPrice(monthlyPrice, config.annualDiscountRate)
        : monthlyPrice;

    // Check price overrides
    const override = overrides.find(
      (o) =>
        o.activity_code.toUpperCase() === activity &&
        o.plan_code.toUpperCase() === code &&
        normalizePeriod(o.billing_period) === period
    );

    const priceXof = override?.price_xof ?? normalPriceCalculated;
    const monthlyEquivalent = period === "ANNUAL" ? Math.round(priceXof / 12) : priceXof;
    const undiscountedTotal = monthlyPrice * (period === "ANNUAL" ? 12 : 1);
    const savingsXof = Math.max(0, undiscountedTotal - priceXof);
    const discountPercent = period === "ANNUAL" ? 25 : 0;

    return {
      code,
      activity,
      label: isSpecial ? `${config.label} — Option spéciale` : `${config.label} — Standard`,
      isSpecial,
      billingPeriod: period,
      durationMonths: period === "ANNUAL" ? 12 : 1,
      priceXof,
      basePriceXof: monthlyPrice,
      monthlyPriceXof: monthlyEquivalent,
      savingsXof,
      discountPercent,
      description: isSpecial ? config.specialDescription : config.tagline,
      features: isSpecial ? [...config.normalFeatures, ...config.specialFeatures] : config.normalFeatures,
      quoteRequired: false,
    };
  });
}

export function getSubscriptionActivityCatalog(
  overrides: readonly SubscriptionPriceOverride[] = [],
  billingPeriod: BillingPeriod = "MONTHLY"
) {
  return subscriptionActivityCodes.map((code) => {
    const config = referenceActivityConfigs[code];
    return {
      code,
      label: config.label,
      tagline: config.tagline,
      isAvailable: config.isAvailable,
      includedServices: config.normalFeatures,
      specialServices: config.specialFeatures,
      plans: getSubscriptionCatalog(code, overrides, billingPeriod),
    };
  });
}

export function subscriptionIsExpired(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
  subscriptionExpiresAt: string | null | undefined,
  now = Date.now()
): boolean {
  const normalized = String(status ?? "").toUpperCase();
  if (["SUSPENDED", "EXPIRED", "CANCELLED"].includes(normalized)) return true;
  const cutoff = subscriptionExpiresAt || trialEndsAt;
  return Boolean(cutoff && new Date(cutoff).getTime() <= now);
}

export function subscriptionDisplayStatus(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
  subscriptionExpiresAt: string | null | undefined,
  now = Date.now()
): string {
  if (subscriptionIsExpired(status, trialEndsAt, subscriptionExpiresAt, now)) return "Expiré";
  const cutoff = subscriptionExpiresAt || trialEndsAt;
  if (cutoff && new Date(cutoff).getTime() - now <= 7 * 24 * 60 * 60 * 1000) return "Expire bientôt";
  if (subscriptionExpiresAt) return "Actif";
  if (String(status ?? "").toUpperCase() === "TRIAL") return "Essai";
  return "À activer";
}

export function companyHasSpecialOption(
  company: { activity_type?: string | null; subscription_plan?: string | null; has_special_option?: boolean | null } | null | undefined
): boolean {
  if (!company) return false;
  if (company.has_special_option === true) return true;
  const plan = String(company.subscription_plan ?? "").toUpperCase();
  return (
    plan === "SPECIAL" ||
    plan === "PRESTIGE" ||
    plan === "BAR_RESTAURANT_SPECIAL" ||
    plan.endsWith("_SPECIAL")
  );
}

export function companyHasPowerFeatures(
  company: { activity_type?: string | null; subscription_plan?: string | null; has_special_option?: boolean | null } | null | undefined
): boolean {
  if (!company) return false;
  const activity = normalizeActivityCode(company.activity_type);
  if (company.activity_type === "POWER" || company.activity_type === "HOTEL_AUBERGE") return true;
  if (activity === "BAR_RESTAURANT" && companyHasSpecialOption(company)) return true;
  return false;
}

export interface BuvetteLimits {
  maxServeuses: number | null; // 5 pour option normale, null (illimité) pour option spéciale
  maxTables: number | null; // 15 pour option normale, null (illimité) pour option spéciale
  maxStores: number | null; // 1 pour option normale, null (illimité) pour option spéciale
  canUseQrCodeMenu: boolean; // false pour normale, true pour spéciale
  canUseAccounting: boolean; // false pour normale, true pour spéciale
  canUseTreasuryAssets: boolean; // false pour normale, true pour spéciale
}

export function getBuvetteLimits(
  company: { activity_type?: string | null; subscription_plan?: string | null; has_special_option?: boolean | null } | null | undefined
): BuvetteLimits {
  const isSpecial = companyHasSpecialOption(company);
  if (isSpecial) {
    return {
      maxServeuses: null,
      maxTables: null,
      maxStores: null,
      canUseQrCodeMenu: true,
      canUseAccounting: true,
      canUseTreasuryAssets: true,
    };
  }
  return {
    maxServeuses: 5,
    maxTables: 15,
    maxStores: 1,
    canUseQrCodeMenu: false,
    canUseAccounting: false,
    canUseTreasuryAssets: false,
  };
}


