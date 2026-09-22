// DebitMaster subscriptions: trois plans standards et un plan spécial sur cotation.
export const subscriptionPlanCodes = ["BUVETTE", "BAR_RESTAURANT", "HOTEL_AUBERGE", "SPECIAL"] as const;
export type SubscriptionPlanCode = (typeof subscriptionPlanCodes)[number];
export const standardSubscriptionPlanCodes = ["BUVETTE", "BAR_RESTAURANT", "HOTEL_AUBERGE"] as const;
export type StandardSubscriptionPlanCode = (typeof standardSubscriptionPlanCodes)[number];
export const billingPeriodCodes = ["MONTHLY", "ANNUAL"] as const;
export type BillingPeriod = (typeof billingPeriodCodes)[number];

export type SubscriptionPriceOverride = { activity_code: string; plan_code: string; billing_period?: string | null; price_xof: number; description?: string | null };
type PlanDefinition = { label: string; monthlyPriceXof: number; annualPriceXof: number; description: string; features: string[]; quoteRequired?: boolean };

const planDefinitions: Record<SubscriptionPlanCode, PlanDefinition> = {
  BUVETTE: { label: "Buvette", monthlyPriceXof: 40000, annualPriceXof: 360000, description: "Pour vendre des boissons uniquement.", features: ["Vente de boissons", "Stocks et inventaire", "Équipe et rapports"] },
  BAR_RESTAURANT: { label: "Bar et restaurant", monthlyPriceXof: 60000, annualPriceXof: 540000, description: "Pour vendre des boissons et des repas, y compris pour une boîte de nuit ou un lounge.", features: ["Vente de boissons", "Vente de repas", "Commandes, cuisine et stocks", "Équipe et rapports"] },
  HOTEL_AUBERGE: { label: "Hôtel et auberge", monthlyPriceXof: 75000, annualPriceXof: 675000, description: "Pour vendre des boissons, des repas et gérer des chambres.", features: ["Vente de boissons", "Vente de repas", "Chambres et hébergement", "Équipe et rapports"] },
  SPECIAL: { label: "Spécial sur cotation", monthlyPriceXof: 0, annualPriceXof: 0, description: "Ajoutez des activités complémentaires comme Gym, Lavage ou Wi-Fi après étude de votre demande.", features: ["Activités complémentaires sur demande", "Prix personnalisé", "Environnement configuré selon le devis"], quoteRequired: true },
};

const activityDefinitions: Record<string, { label: string; includedServices: string[]; commonServices: string[] }> = {
  BUVETTE: { label: "Buvette", includedServices: ["Vente de boissons"], commonServices: ["Stocks, inventaire, équipe et rapports"] },
  BAR_RESTAURANT: { label: "Bar et restaurant", includedServices: ["Vente de boissons", "Vente de repas"], commonServices: ["Commandes, cuisine, stocks, équipe et rapports"] },
  NIGHTCLUB_LOUNGE: { label: "Boîte de nuit et lounge", includedServices: ["Vente de boissons", "Vente de repas"], commonServices: ["Commandes, stocks, équipe et rapports"] },
  HOTEL_AUBERGE: { label: "Hôtel et auberge", includedServices: ["Vente de boissons", "Vente de repas", "Chambres et hébergement"], commonServices: ["Stocks, équipe et rapports"] },
};

export const subscriptionActivityCodes = ["BUVETTE", "BAR_RESTAURANT", "NIGHTCLUB_LOUNGE", "HOTEL_AUBERGE"] as const;
export const freeTrialDays = 30;

function normalizePeriod(period: string | null | undefined): BillingPeriod { return String(period ?? "MONTHLY").toUpperCase() === "ANNUAL" ? "ANNUAL" : "MONTHLY"; }
function normalizePlan(plan: string) {
  const normalized = plan.toUpperCase();
  const aliases: Record<string, string> = { BAR: "BUVETTE", RESTAURANT: "BAR_RESTAURANT", HOTELS: "HOTEL_AUBERGE", PRESTIGE: "SPECIAL", BASE: "BUVETTE", MOYENNE: "BAR_RESTAURANT", SEMESTRIELLE: "HOTEL_AUBERGE", SUPREME: "SPECIAL", POWER: "SPECIAL" };
  return aliases[normalized] ?? normalized;
}
function overrideMap(overrides: readonly SubscriptionPriceOverride[]) { return new Map(overrides.map((override) => [`${override.activity_code.toUpperCase()}:${normalizePlan(override.plan_code)}:${normalizePeriod(override.billing_period)}`, override])); }
export function normalizeActivityCode(type: string) { return type.toUpperCase() === "POWER" ? "HOTEL_AUBERGE" : type.toUpperCase(); }
export function getActivityPricing(activityType: string) { return activityDefinitions[normalizeActivityCode(activityType)] ?? activityDefinitions.BUVETTE; }
export function getSubscriptionPlan(plan: string) { return planDefinitions[normalizePlan(plan) as SubscriptionPlanCode] ?? null; }
export function getSubscriptionFeatures(plan: string) { return getSubscriptionPlan(plan)?.features ?? []; }
export function isQuoteRequired(plan: string) { return getSubscriptionPlan(plan)?.quoteRequired === true; }

export function getSubscriptionPrice(activityType: string, plan: string, billingPeriod: BillingPeriod = "MONTHLY", overrides: readonly SubscriptionPriceOverride[] = []) {
  const normalizedPlan = normalizePlan(plan) as SubscriptionPlanCode;
  const definition = getSubscriptionPlan(normalizedPlan);
  if (!definition || definition.quoteRequired) return null;
  const prices = overrideMap(overrides);
  const activityCode = normalizeActivityCode(activityType);
  const override = prices.get(`${activityCode}:${normalizedPlan}:${billingPeriod}`) ?? prices.get(`BAR_RESTAURANT:${normalizedPlan}:${billingPeriod}`) ?? prices.get(`BUVETTE:${normalizedPlan}:${billingPeriod}`);
  return override?.price_xof ?? (billingPeriod === "ANNUAL" ? definition.annualPriceXof : definition.monthlyPriceXof);
}
export function addSubscriptionPeriod(start: Date, billingPeriod: BillingPeriod = "MONTHLY") { const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + (billingPeriod === "ANNUAL" ? 12 : 1)); return end; }
export function getSubscriptionCatalog(activityType: string, overrides: readonly SubscriptionPriceOverride[] = [], billingPeriod: BillingPeriod = "MONTHLY") {
  const prices = overrideMap(overrides); const activityCode = normalizeActivityCode(activityType);
  return subscriptionPlanCodes.map((code) => { const definition = planDefinitions[code]; const override = prices.get(`${activityCode}:${code}:${billingPeriod}`) ?? prices.get(`BAR_RESTAURANT:${code}:${billingPeriod}`) ?? prices.get(`BUVETTE:${code}:${billingPeriod}`); const priceXof = definition.quoteRequired ? 0 : override?.price_xof ?? (billingPeriod === "ANNUAL" ? definition.annualPriceXof : definition.monthlyPriceXof); const monthlyEquivalent = billingPeriod === "ANNUAL" && priceXof ? Math.round(priceXof / 12) : priceXof; return { code, label: definition.label, billingPeriod, durationMonths: billingPeriod === "ANNUAL" ? 12 : 1, priceXof, basePriceXof: definition.monthlyPriceXof, monthlyPriceXof: monthlyEquivalent, savingsXof: definition.quoteRequired ? 0 : Math.max(0, definition.monthlyPriceXof * (billingPeriod === "ANNUAL" ? 12 : 1) - priceXof), discountPercent: definition.quoteRequired ? 0 : billingPeriod === "ANNUAL" ? 25 : 0, description: override?.description || definition.description, features: definition.features, quoteRequired: definition.quoteRequired ?? false }; });
}
export function getSubscriptionActivityCatalog(overrides: readonly SubscriptionPriceOverride[] = [], billingPeriod: BillingPeriod = "MONTHLY") { return subscriptionActivityCodes.map((code) => ({ code, label: getActivityPricing(code).label, includedServices: getActivityPricing(code).includedServices, commonServices: getActivityPricing(code).commonServices, plans: getSubscriptionCatalog(code, overrides, billingPeriod) })); }
export function subscriptionIsExpired(status: string | null | undefined, trialEndsAt: string | null | undefined, subscriptionExpiresAt: string | null | undefined, now = Date.now()) { const normalized = String(status ?? "").toUpperCase(); if (["SUSPENDED", "EXPIRED", "CANCELLED"].includes(normalized)) return true; const cutoff = subscriptionExpiresAt || trialEndsAt; return Boolean(cutoff && new Date(cutoff).getTime() <= now); }
export function subscriptionDisplayStatus(status: string | null | undefined, trialEndsAt: string | null | undefined, subscriptionExpiresAt: string | null | undefined, now = Date.now()) { if (subscriptionIsExpired(status, trialEndsAt, subscriptionExpiresAt, now)) return "Expiré"; const cutoff = subscriptionExpiresAt || trialEndsAt; if (cutoff && new Date(cutoff).getTime() - now <= 7 * 24 * 60 * 60 * 1000) return "Expire bientôt"; if (subscriptionExpiresAt) return "Actif"; if (String(status ?? "").toUpperCase() === "TRIAL") return "Essai"; return "À activer"; }
export function isLegacyActivityCode(value: string) { return subscriptionActivityCodes.includes(value.toUpperCase() as (typeof subscriptionActivityCodes)[number]); }
