// DebitManager subscriptions: catalogue serveur unique, tarifs XOF éditables côté super-administration, Power réservé aux établissements multi-activités.

export const subscriptionPlanCodes = ["BASE", "MOYENNE", "SEMESTRIELLE", "SUPREME"] as const;
export type SubscriptionPlanCode = (typeof subscriptionPlanCodes)[number];

export type SubscriptionPriceOverride = {
  activity_code: string;
  plan_code: string;
  price_xof: number;
  description?: string | null;
};

type PlanDefinition = { label: string; durationMonths: number; basePriceXof: number; description: string };

const planDefinitions: Record<SubscriptionPlanCode, PlanDefinition> = {
  BASE: { label: "Base", durationMonths: 1, basePriceXof: 50000, description: "La formule mensuelle pour démarrer avec l’essentiel." },
  MOYENNE: { label: "Moyenne", durationMonths: 3, basePriceXof: 130000, description: "Trois mois de pilotage avec un tarif plus avantageux." },
  SEMESTRIELLE: { label: "Semestrielle", durationMonths: 6, basePriceXof: 240000, description: "Une visibilité de six mois pour stabiliser l’exploitation." },
  SUPREME: { label: "Suprême", durationMonths: 12, basePriceXof: 400000, description: "La formule annuelle pour piloter sereinement toute l’année." },
};

const activityDefinitions: Record<string, { label: string; multiplier: number; includedServices: string[] }> = {
  BAR: { label: "Bar", multiplier: 1, includedServices: ["Vente de boissons seules", "Bières, sucreries et boissons énergisantes"] },
  BUVETTE: { label: "Bar", multiplier: 1, includedServices: ["Vente de boissons seules", "Bières, sucreries et boissons énergisantes"] },
  BAR_RESTAURANT: { label: "Bar restaurant", multiplier: 1.5, includedServices: ["Vente de boissons et de repas", "Configuration des repas et des plats"] },
  NIGHTCLUB_LOUNGE: { label: "Boîte de nuit / Lounge", multiplier: 2, includedServices: ["Vente de boissons, champagnes, spiritueux et vins", "Gestion adaptée à une activité de nuit et lounge"] },
  POWER: { label: "Power", multiplier: 3, includedServices: ["Boissons et repas", "Gym, lavage, auberge et Wi-Fi", "Pilotage multi-activités avec équipes et caisses séparées"] },
};

const commonServices = ["Commandes, ventes et paiements clients", "Stocks, inventaire et approvisionnements", "Équipe, horaires, tables, rapports et KPI"];

export const subscriptionActivityCodes = ["BAR", "BAR_RESTAURANT", "NIGHTCLUB_LOUNGE", "POWER"] as const;

function overrideMap(overrides: readonly SubscriptionPriceOverride[]) {
  return new Map(overrides.map((override) => [`${override.activity_code.toUpperCase()}:${override.plan_code.toUpperCase()}`, override]));
}

function effectivePrice(activityType: string, plan: SubscriptionPlanCode, overrides: readonly SubscriptionPriceOverride[]) {
  const activity = getActivityPricing(activityType);
  const definition = planDefinitions[plan];
  const override = overrideMap(overrides).get(`${activityType.toUpperCase()}:${plan}`) ?? overrideMap(overrides).get(`${normalizeActivityCode(activityType)}:${plan}`);
  return { priceXof: override?.price_xof ?? Math.round(definition.basePriceXof * activity.multiplier), description: override?.description || definition.description };
}

export function normalizeActivityCode(type: string) {
  return type.toUpperCase() === "BUVETTE" ? "BAR" : type.toUpperCase();
}

export function getActivityPricing(activityType: string) {
  return activityDefinitions[normalizeActivityCode(activityType)] ?? activityDefinitions.BUVETTE;
}

export function getSubscriptionPlan(plan: string) {
  return planDefinitions[plan.toUpperCase() as SubscriptionPlanCode] ?? null;
}

export function getSubscriptionPrice(activityType: string, plan: string, overrides: readonly SubscriptionPriceOverride[] = []) {
  const normalizedPlan = plan.toUpperCase() as SubscriptionPlanCode;
  if (!getSubscriptionPlan(normalizedPlan)) return null;
  return effectivePrice(activityType, normalizedPlan, overrides).priceXof;
}

export function addSubscriptionPeriod(start: Date, plan: string) {
  const definition = getSubscriptionPlan(plan);
  if (!definition) return null;
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + definition.durationMonths);
  return end;
}

export function getSubscriptionCatalog(activityType: string, overrides: readonly SubscriptionPriceOverride[] = []) {
  const activity = getActivityPricing(activityType);
  const prices = overrideMap(overrides);
  return subscriptionPlanCodes.map((code) => {
    const definition = planDefinitions[code];
    const override = prices.get(`${normalizeActivityCode(activityType)}:${code}`);
    const priceXof = override?.price_xof ?? Math.round(definition.basePriceXof * activity.multiplier);
    const baseMonthlyPriceXof = Math.round(planDefinitions.BASE.basePriceXof * activity.multiplier);
    const monthlyPriceXof = Math.round(priceXof / definition.durationMonths);
    const savingsXof = Math.max(0, baseMonthlyPriceXof * definition.durationMonths - priceXof);
    const discountPercent = baseMonthlyPriceXof > 0 ? (1 - monthlyPriceXof / baseMonthlyPriceXof) * 100 : 0;
    return { code, label: definition.label, durationMonths: definition.durationMonths, priceXof, basePriceXof: definition.basePriceXof, monthlyPriceXof, savingsXof, discountPercent, description: override?.description || definition.description };
  });
}

export function getSubscriptionActivityCatalog(overrides: readonly SubscriptionPriceOverride[] = []) {
  return subscriptionActivityCodes.map((code) => {
    const activity = getActivityPricing(code);
    return { code, label: activity.label, multiplier: activity.multiplier, includedServices: activity.includedServices, commonServices, plans: getSubscriptionCatalog(code, overrides) };
  });
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
