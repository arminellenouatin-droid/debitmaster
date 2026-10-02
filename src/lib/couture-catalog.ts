export type CoutureGender = "HOMME" | "FEMME" | "ENFANT" | "UNISEXE";

export type CoutureModel = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  gender: CoutureGender;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CoutureRange = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  rank: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CouturePriceGridEntry = {
  id: string;
  tenant_id: string;
  model_id: string;
  range_id: string;
  price_adult_xof: number;
  price_child_xof: number;
  created_at: string;
  updated_at: string;
};

export type CoutureSize = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  rank: number;
  is_active: boolean;
};

export type CoutureColor = {
  id: string;
  tenant_id: string;
  name: string;
  hex_code: string | null;
  is_active: boolean;
};

export type CoutureAccessory = {
  id: string;
  tenant_id: string;
  name: string;
  category: "SAC" | "CHAUSSETTES" | "LUNETTES" | "MANCHETTES" | "MONTRE" | "AUTRE";
  selling_price_xof: number;
  purchase_cost_xof: number | null;
  stock_alert_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CoutureMeasurements = {
  neck?: number | null; // Cou
  chest?: number | null; // Tour de poitrine
  waist?: number | null; // Tour de taille
  hips?: number | null; // Tour de hanches / bassin
  shoulder_front?: number | null; // Carrure devant
  shoulder_back?: number | null; // Carrure dos
  sleeve_length?: number | null; // Longueur manche
  arm_circumference?: number | null; // Tour de bras / biceps
  wrist?: number | null; // Poignet
  jacket_length?: number | null; // Longueur veste / chemise
  dress_length?: number | null; // Longueur robe / boubou
  pants_length?: number | null; // Longueur pantalon
  thigh_circumference?: number | null; // Tour de cuisse
  pants_bottom?: number | null; // Bas pantalon
  crotch?: number | null; // Entrejambe
};

export type CoutureBeneficiary = {
  name: string;
  relationship?: string | null;
  gender?: CoutureGender | null;
  measurements?: CoutureMeasurements;
};

export type CoutureCustomer = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  gender: CoutureGender;
  birthday: string | null;
  notes: string | null;
  measurements: CoutureMeasurements;
  habitual_beneficiaries: CoutureBeneficiary[];
  photo_url: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
};

export const defaultCoutureSizes = [
  { code: "S", name: "S (Small)", rank: 1 },
  { code: "M", name: "M (Medium)", rank: 2 },
  { code: "MK", name: "MK (Medium King)", rank: 3 },
  { code: "L", name: "L (Large)", rank: 4 },
  { code: "XL", name: "XL (Extra Large)", rank: 5 },
  { code: "2XL", name: "2XL (Double XL)", rank: 6 },
  { code: "3XL", name: "3XL (Triple XL)", rank: 7 },
  { code: "SUR_MESURE", name: "Sur mesure", rank: 8 },
] as const;

export const defaultCoutureRanges = [
  { name: "Leader", rank: 1, description: "Gamme quotidienne sobre et élégante" },
  { name: "VIP", rank: 2, description: "Gamme supérieure avec finitions soignées" },
  { name: "Royale", rank: 3, description: "Gamme prestige avec broderies et tissus nobles" },
  { name: "Présidentiel", rank: 4, description: "Gamme haute couture d'exception" },
] as const;

export const defaultDistinctionModels = [
  { name: "Goodluck", gender: "HOMME", description: "Ensemble tunique col Mao et pantalon habillé" },
  { name: "Danshiki", gender: "HOMME", description: "Tunique traditionnelle ample brodée" },
  { name: "Agbada", gender: "HOMME", description: "Grand boubou 3 pièces royal" },
  { name: "Abacost", gender: "HOMME", description: "Costume africain contemporain col officier" },
  { name: "Robe", gender: "FEMME", description: "Robe de cérémonie ou soirée sur mesure" },
  { name: "Boubou", gender: "FEMME", description: "Grand boubou féminin brodé et orné" },
] as const;

// Grille de prix par défaut de l'établissement « DISTINCTION » (section 17 du PRD)
export const defaultDistinctionPriceMatrix: Record<string, Record<string, number>> = {
  Goodluck: { Leader: 120_000, VIP: 200_000, Royale: 350_000, Présidentiel: 500_000 },
  Danshiki: { Leader: 150_000, VIP: 350_000, Royale: 500_000, Présidentiel: 700_000 },
  Agbada: { Leader: 300_000, VIP: 500_000, Royale: 700_000, Présidentiel: 900_000 },
  Abacost: { Leader: 250_000, VIP: 400_000, Royale: 600_000, Présidentiel: 900_000 },
  Robe: { Leader: 100_000, VIP: 200_000, Royale: 350_000, Présidentiel: 600_000 },
  Boubou: { Leader: 100_000, VIP: 200_000, Royale: 350_000, Présidentiel: 500_000 },
};

/**
 * Calcule automatiquement le prix enfant (la moitié du prix adulte par défaut, sans décimales).
 */
export function computeChildPrice(adultPrice: number): number {
  if (!Number.isFinite(adultPrice) || adultPrice <= 0) return 0;
  return Math.round(adultPrice / 2);
}

const measurementKeys: (keyof CoutureMeasurements)[] = [
  "neck", "chest", "waist", "hips",
  "shoulder_front", "shoulder_back",
  "sleeve_length", "arm_circumference", "wrist",
  "jacket_length", "dress_length", "pants_length",
  "thigh_circumference", "pants_bottom", "crotch"
];

/**
 * Nettoie et valide un objet de mensurations (en centimètres, valeurs entre 10 et 300 cm).
 */
export function sanitizeMeasurements(raw: unknown): CoutureMeasurements {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const cleaned: CoutureMeasurements = {};
  const record = raw as Record<string, unknown>;

  for (const key of measurementKeys) {
    const val = record[key];
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (Number.isFinite(num) && num >= 5 && num <= 350) {
        cleaned[key] = Math.round(num * 10) / 10;
      }
    }
  }
  return cleaned;
}

/**
 * Nettoie et valide une liste de bénéficiaires habituels.
 */
export function sanitizeBeneficiaries(raw: unknown): CoutureBeneficiary[] {
  if (!Array.isArray(raw)) return [];
  const valid: CoutureBeneficiary[] = [];

  for (const item of raw.slice(0, 20)) {
    if (item && typeof item === "object") {
      const name = typeof item.name === "string" ? item.name.trim().slice(0, 100) : "";
      if (name.length >= 2) {
        const relationship = typeof item.relationship === "string" ? item.relationship.trim().slice(0, 60) : null;
        const gender = ["HOMME", "FEMME", "ENFANT", "UNISEXE"].includes(item.gender) ? item.gender : null;
        const measurements = sanitizeMeasurements(item.measurements);
        valid.push({ name, relationship, gender, measurements });
      }
    }
  }
  return valid;
}
