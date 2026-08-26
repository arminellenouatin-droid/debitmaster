// DebitManager subscriptions: catalogue serveur unique, tarifs en XOF et coefficients liés à l’activité de l’établissement.

export const subscriptionPlanCodes = ["BASE", "MOYENNE", "SEMESTRIELLE", "SUPREME"] as const;
export type SubscriptionPlanCode = (typeof subscriptionPlanCodes)[number];

const planDefinitions: Record<SubscriptionPlanCode, { label: string; durationMonths: number; basePriceXof: number; description: string }> = {
  BASE: { label: "Base", durationMonths: 1, basePriceXof: 50000, description: "La formule mensuelle pour démarrer avec l’essentiel." },
  MOYENNE: { label: "Moyenne", durationMonths: 3, basePriceXof: 130000, description: "Trois mois de pilotage avec un tarif plus avantageux." },
  SEMESTRIELLE: { label: "Semestrielle", durationMonths: 6, basePriceXof: 240000, description: "Une visibilité de six mois pour stabiliser l’exploitation." },
  SUPREME: { label: "Suprême", durationMonths: 12, basePriceXof: 400000, description: "La formule annuelle pour piloter sereinement toute l’année." },
};

const activityDefinitions: Record<string, { label: string; multiplier: number }> = {
  BAR: { label: "Bar", multiplier: 1 },
  BUVETTE: { label: "Bar", multiplier: 1 },
  BAR_RESTAURANT: { label: "Bar restaurant", multiplier: 1.5 },
  NIGHTCLUB_LOUNGE: { label: "Boîte de nuit / Lounge", multiplier: 2 },
};

export const subscriptionActivityCodes = ["BAR", "BAR_RESTAURANT", "NIGHTCLUB_LOUNGE"] as const;

export function getActivityPricing(activityType: string) {
  return activityDefinitions[activityType] ?? activityDefinitions.BUVETTE;
}

export function getSubscriptionPlan(plan: string) {
  return planDefinitions[plan.toUpperCase() as SubscriptionPlanCode] ?? null;
}

export function getSubscriptionPrice(activityType: string, plan: string) {
  const definition = getSubscriptionPlan(plan);
  if (!definition) return null;
  return Math.round(definition.basePriceXof * getActivityPricing(activityType).multiplier);
}

export function addSubscriptionPeriod(start: Date, plan: string) {
  const definition = getSubscriptionPlan(plan);
  if (!definition) return null;
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + definition.durationMonths);
  return end;
}

export function getSubscriptionCatalog(activityType: string) {
  const activity = getActivityPricing(activityType);
  return subscriptionPlanCodes.map((code) => {
    const definition = planDefinitions[code];
    const priceXof = Math.round(definition.basePriceXof * activity.multiplier);
    const baseMonthlyPriceXof = Math.round(planDefinitions.BASE.basePriceXof * activity.multiplier);
    const monthlyPriceXof = Math.round(priceXof / definition.durationMonths);
    const savingsXof = Math.max(0, baseMonthlyPriceXof * definition.durationMonths - priceXof);
    const discountPercent = baseMonthlyPriceXof > 0 ? (1 - monthlyPriceXof / baseMonthlyPriceXof) * 100 : 0;
    return { code, label: definition.label, durationMonths: definition.durationMonths, priceXof, basePriceXof: definition.basePriceXof, monthlyPriceXof, savingsXof, discountPercent, description: definition.description };
  });
}

export function getSubscriptionActivityCatalog() {
  return subscriptionActivityCodes.map((code) => {
    const activity = getActivityPricing(code);
    return { code, label: activity.label, multiplier: activity.multiplier, plans: getSubscriptionCatalog(code) };
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
