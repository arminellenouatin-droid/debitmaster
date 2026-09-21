// DebitMaster subscriptions: catalogue serveur unique des quatre formules métier et de leurs périodicités.

export const subscriptionPlanCodes = ["BAR", "RESTAURANT", "HOTELS", "PRESTIGE"] as const;
export type SubscriptionPlanCode = (typeof subscriptionPlanCodes)[number];
export const billingPeriodCodes = ["MONTHLY", "ANNUAL"] as const;
export type BillingPeriod = (typeof billingPeriodCodes)[number];

export type SubscriptionPriceOverride = {
  activity_code: string;
  plan_code: string;
  billing_period?: string | null;
  price_xof: number;
  description?: string | null;
};

type PlanDefinition = {
  label: string;
  monthlyPriceXof: number;
  annualPriceXof: number;
  description: string;
  features: string[];
};

const planDefinitions: Record<SubscriptionPlanCode, PlanDefinition> = {
  BAR: {
    label: "Bar",
    monthlyPriceXof: 40000,
    annualPriceXof: 360000,
    description: "L’essentiel pour vendre et piloter les boissons.",
    features: ["Vente de boissons"],
  },
  RESTAURANT: {
    label: "Restaurant",
    monthlyPriceXof: 60000,
    annualPriceXof: 540000,
    description: "Boissons et ventes de repas pour votre restaurant.",
    features: ["Vente de boissons", "Ventes de repas"],
  },
  HOTELS: {
    label: "Hôtels",
    monthlyPriceXof: 75000,
    annualPriceXof: 675000,
    description: "Boissons, repas et gestion des chambres.",
    features: ["Vente de boissons", "Ventes de repas", "Chambres de passage, journée et nuitée"],
  },
  PRESTIGE: {
    label: "Prestige",
    monthlyPriceXof: 100000,
    annualPriceXof: 900000,
    description: "L’ensemble des fonctionnalités du projet BAR SANTE PLUS.",
    features: ["Toutes les fonctionnalités du projet actuel", "Boissons, repas, chambres, gym, lavage et Wi-Fi"],
  },
};

const activityDefinitions: Record<string, { label: string; includedServices: string[]; commonServices: string[] }> = {
  BAR: { label: "Bar", includedServices: ["Vente de boissons"], commonServices: ["Commandes, ventes et paiements clients", "Stocks, inventaire et approvisionnements", "Équipe, rapports et KPI"] },
  BUVETTE: { label: "Bar", includedServices: ["Vente de boissons"], commonServices: ["Commandes, ventes et paiements clients", "Stocks, inventaire et approvisionnements", "Équipe, rapports et KPI"] },
  BAR_RESTAURANT: { label: "Bar restaurant", includedServices: ["Vente de boissons", "Ventes de repas"], commonServices: ["Commandes, ventes et paiements clients", "Stocks, inventaire et approvisionnements", "Équipe, tables, rapports et KPI"] },
  NIGHTCLUB_LOUNGE: { label: "Nightclub & lounge", includedServices: ["Vente de boissons", "Ventes de repas"], commonServices: ["Commandes, ventes et paiements clients", "Stocks, inventaire et approvisionnements", "Équipe, rapports et KPI"] },
  POWER: { label: "Power", includedServices: ["Toutes les fonctionnalités du projet actuel"], commonServices: ["Boissons, repas, chambres, gym, lavage et Wi-Fi", "Équipe, caisses et rapports"] },
};

export const subscriptionActivityCodes = ["BAR", "BAR_RESTAURANT", "NIGHTCLUB_LOUNGE", "POWER"] as const;
export const freeTrialDays = 30;
const legacyActivityKeys = new Set(subscriptionActivityCodes);

function normalizePeriod(period: string | null | undefined): BillingPeriod {
  return String(period ?? "MONTHLY").toUpperCase() === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

function normalizePlan(plan: string) {
  const normalized = plan.toUpperCase();
  if (normalized === "BASE") return "BAR";
  if (normalized === "MOYENNE") return "RESTAURANT";
  if (normalized === "SEMESTRIELLE") return "HOTELS";
  if (normalized === "SUPREME") return "PRESTIGE";
  return normalized;
}

function overrideMap(overrides: readonly SubscriptionPriceOverride[]) {
  return new Map(overrides.map((override) => [`${override.activity_code.toUpperCase()}:${normalizePlan(override.plan_code)}:${normalizePeriod(override.billing_period)}`, override]));
}

export function normalizeActivityCode(type: string) {
  return type.toUpperCase() === "BUVETTE" ? "BAR" : type.toUpperCase();
}

export function getActivityPricing(activityType: string) {
  return activityDefinitions[normalizeActivityCode(activityType)] ?? activityDefinitions.BUVETTE;
}

export function getSubscriptionPlan(plan: string) {
  return planDefinitions[normalizePlan(plan) as SubscriptionPlanCode] ?? null;
}

export function getSubscriptionFeatures(plan: string) {
  return getSubscriptionPlan(plan)?.features ?? [];
}

export function getSubscriptionPrice(activityType: string, plan: string, billingPeriod: BillingPeriod = "MONTHLY", overrides: readonly SubscriptionPriceOverride[] = []) {
  const normalizedPlan = normalizePlan(plan) as SubscriptionPlanCode;
  const definition = getSubscriptionPlan(normalizedPlan);
  if (!definition) return null;
  const activityCode = normalizeActivityCode(activityType);
  const prices = overrideMap(overrides);
  const override = prices.get(`${activityCode}:${normalizedPlan}:${billingPeriod}`) ?? prices.get(`BAR:${normalizedPlan}:${billingPeriod}`);
  return override?.price_xof ?? (billingPeriod === "ANNUAL" ? definition.annualPriceXof : definition.monthlyPriceXof);
}

export function addSubscriptionPeriod(start: Date, billingPeriod: BillingPeriod = "MONTHLY") {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + (billingPeriod === "ANNUAL" ? 12 : 1));
  return end;
}

export function getSubscriptionCatalog(activityType: string, overrides: readonly SubscriptionPriceOverride[] = [], billingPeriod: BillingPeriod = "MONTHLY") {
  const prices = overrideMap(overrides);
  const activityCode = normalizeActivityCode(activityType);
  return subscriptionPlanCodes.map((code) => {
    const definition = planDefinitions[code];
    const override = prices.get(`${activityCode}:${code}:${billingPeriod}`) ?? prices.get(`BAR:${code}:${billingPeriod}`);
    const priceXof = override?.price_xof ?? (billingPeriod === "ANNUAL" ? definition.annualPriceXof : definition.monthlyPriceXof);
    const monthlyReference = definition.monthlyPriceXof;
    const monthlyEquivalent = billingPeriod === "ANNUAL" ? Math.round(priceXof / 12) : priceXof;
    const savingsXof = Math.max(0, monthlyReference * (billingPeriod === "ANNUAL" ? 12 : 1) - priceXof);
    return {
      code,
      label: definition.label,
      billingPeriod,
      durationMonths: billingPeriod === "ANNUAL" ? 12 : 1,
      priceXof,
      basePriceXof: monthlyReference,
      monthlyPriceXof: monthlyEquivalent,
      savingsXof,
      discountPercent: billingPeriod === "ANNUAL" ? 25 : 0,
      description: override?.description || definition.description,
      features: definition.features,
    };
  });
}

export function getSubscriptionActivityCatalog(overrides: readonly SubscriptionPriceOverride[] = [], billingPeriod: BillingPeriod = "MONTHLY") {
  return subscriptionActivityCodes.map((code) => ({
    code,
    label: getActivityPricing(code).label,
    includedServices: getActivityPricing(code).includedServices,
    commonServices: getActivityPricing(code).commonServices,
    plans: getSubscriptionCatalog(code, overrides, billingPeriod),
  }));
}

export function subscriptionIsExpired(status: string | null | undefined, trialEndsAt: string | null | undefined, subscriptionExpiresAt: string | null | undefined, now = Date.now()) {
  const normalized = String(status ?? "").toUpperCase();
  if (["SUSPENDED", "EXPIRED", "CANCELLED"].includes(normalized)) return true;
  const cutoff = subscriptionExpiresAt || trialEndsAt;
  return Boolean(cutoff && new Date(cutoff).getTime() <= now);
}

export function subscriptionDisplayStatus(status: string | null | undefined, trialEndsAt: string | null | undefined, subscriptionExpiresAt: string | null | undefined, now = Date.now()) {
  if (subscriptionIsExpired(status, trialEndsAt, subscriptionExpiresAt, now)) return "Expiré";
  const cutoff = subscriptionExpiresAt || trialEndsAt;
  if (cutoff && new Date(cutoff).getTime() - now <= 7 * 24 * 60 * 60 * 1000) return "Expire bientôt";
  if (subscriptionExpiresAt) return "Actif";
  if (String(status ?? "").toUpperCase() === "TRIAL") return "Essai";
  return "À activer";
}

export function isLegacyActivityCode(value: string) {
  return legacyActivityKeys.has(value.toUpperCase() as (typeof subscriptionActivityCodes)[number]);
}
