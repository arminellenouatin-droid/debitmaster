export type CoutureIncentiveConfig = {
  pointsPerStepXof: number; // Défaut : 50 000 FCFA pour 1 point
  weeklyTopSellerBonusXof: number; // Défaut : 10 000 FCFA
  monthlyTopSellerBonusXof: number; // Défaut : 30 000 FCFA
  highTicketThresholdXof: number; // Défaut : 1 000 000 FCFA
  highTicketBonusRate: number; // Défaut : 0.02 (2 %)
  lowPerformancePointsThreshold: number; // Défaut : 60 points
  annualTop1MinPoints: number; // Défaut : 1 600 points
  annualTop2MinPoints: number; // Défaut : 900 points
};

export const defaultCoutureIncentiveConfig: CoutureIncentiveConfig = {
  pointsPerStepXof: 50_000,
  weeklyTopSellerBonusXof: 10_000,
  monthlyTopSellerBonusXof: 30_000,
  highTicketThresholdXof: 1_000_000,
  highTicketBonusRate: 0.02,
  lowPerformancePointsThreshold: 60,
  annualTop1MinPoints: 1_600,
  annualTop2MinPoints: 900,
};

/**
 * Calcule les points de vente et la prime éventuelle de gros achat (> 1M FCFA).
 * Conformément au PRD §12.4 :
 * - 1 point par tranche de 50 000 FCFA vendue.
 * - Vente unique > 1 000 000 FCFA déclenche automatiquement une prime de 2 % au vendeur.
 */
export function calculateSaleIncentives(
  saleAmountXof: number,
  config: CoutureIncentiveConfig = defaultCoutureIncentiveConfig
): {
  pointsEarned: number;
  isHighTicket: boolean;
  highTicketBonusXof: number;
} {
  const amount = Math.max(0, Math.round(Number(saleAmountXof) || 0));
  const step = Math.max(1, config.pointsPerStepXof);
  const pointsEarned = Math.floor(amount / step);

  const isHighTicket = amount > config.highTicketThresholdXof;
  const highTicketBonusXof = isHighTicket
    ? Math.round(amount * config.highTicketBonusRate)
    : 0;

  return {
    pointsEarned,
    isHighTicket,
    highTicketBonusXof,
  };
}

/**
 * Calcule la prime trimestrielle de fidélité client :
 * Prime de 2 % des ventes si un même client a acheté :
 * - au moins 4 fois dans le trimestre, OU
 * - au moins 2 fois si le total dépasse 3 500 000 FCFA.
 */
export function evaluateCustomerLoyaltyBonus(
  quarterlyOrdersCount: number,
  quarterlyTotalXof: number
): {
  isEligible: boolean;
  loyaltyBonusXof: number;
} {
  const count = Math.max(0, Math.round(Number(quarterlyOrdersCount) || 0));
  const total = Math.max(0, Math.round(Number(quarterlyTotalXof) || 0));

  const condition1 = count >= 4;
  const condition2 = count >= 2 && total > 3_500_000;

  const isEligible = condition1 || condition2;
  const loyaltyBonusXof = isEligible ? Math.round(total * 0.02) : 0;

  return {
    isEligible,
    loyaltyBonusXof,
  };
}

export type AnnualRewardTier = "CAR_AND_FUEL_BONUS_300K" | "MOTORCYCLE_AND_FUEL_BONUS_150K" | null;

/**
 * Évalue les récompenses annuelles d'excellence commerciale :
 * - 1er vendeur (>= 1600 points) + 3 ans d'ancienneté : Voiture neuve + bon carburant 300 000 FCFA.
 * - 2ème vendeur (>= 900 points) + 3 ans d'ancienneté : Moto neuve + bon carburant 150 000 FCFA.
 */
export function evaluateAnnualRewards(
  annualPoints: number,
  yearsOfSeniority: number,
  config: CoutureIncentiveConfig = defaultCoutureIncentiveConfig
): {
  tier: AnnualRewardTier;
  meetsSeniority: boolean;
  fuelVoucherXof: number;
  label: string;
} {
  const points = Math.max(0, Math.round(Number(annualPoints) || 0));
  const seniority = Math.max(0, Number(yearsOfSeniority) || 0);
  const meetsSeniority = seniority >= 3;

  if (points >= config.annualTop1MinPoints && meetsSeniority) {
    return {
      tier: "CAR_AND_FUEL_BONUS_300K",
      meetsSeniority: true,
      fuelVoucherXof: 300_000,
      label: "Voiture neuve + Bon de carburant de 300 000 FCFA",
    };
  }

  if (points >= config.annualTop2MinPoints && meetsSeniority) {
    return {
      tier: "MOTORCYCLE_AND_FUEL_BONUS_150K",
      meetsSeniority: true,
      fuelVoucherXof: 150_000,
      label: "Moto neuve + Bon de carburant de 150 000 FCFA",
    };
  }

  return {
    tier: null,
    meetsSeniority,
    fuelVoucherXof: 0,
    label: meetsSeniority
      ? "Points insuffisants pour le palier annuel"
      : "Ancienneté minimale de 3 ans requise pour les récompenses annuelles de véhicule",
  };
}

export type SellerPerformanceAlertLevel = "NONE" | "LOW_PERFORMANCE_WARNING" | "REINFORCED_PERFORMANCE_WARNING";

/**
 * Alertes de motivation commerciale :
 * - Un vendeur sous 60 points sur un mois : alerte niveau 1.
 * - Sous ce seuil deux mois de suite : alerte niveau 2 renforcée pour accompagnement RH.
 */
export function evaluateMonthlySellerAlert(
  currentMonthPoints: number,
  previousMonthPoints: number | null = null,
  threshold = 60
): {
  alertLevel: SellerPerformanceAlertLevel;
  message: string;
} {
  const current = Math.max(0, Math.round(Number(currentMonthPoints) || 0));
  const prev = previousMonthPoints !== null ? Math.max(0, Math.round(Number(previousMonthPoints) || 0)) : null;

  if (current < threshold) {
    if (prev !== null && prev < threshold) {
      return {
        alertLevel: "REINFORCED_PERFORMANCE_WARNING",
        message: `Alerte renforcée : performance sous le seuil de ${threshold} points pendant 2 mois consécutifs (${prev} pts puis ${current} pts). Accompagnement managérial requis.`,
      };
    }
    return {
      alertLevel: "LOW_PERFORMANCE_WARNING",
      message: `Alerte de motivation : performance mensuelle sous le seuil (${current} points réalisés sur ${threshold} requis).`,
    };
  }

  return {
    alertLevel: "NONE",
    message: "Objectif de points mensuel atteint.",
  };
}

/**
 * Calcul de la distance géodésique (formule de Haversine) en mètres entre deux points GPS.
 */
export function calculateGpsDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Rayon moyen de la Terre en mètres
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Vérifie si un employé est physiquement présent sur son site de travail.
 */
export function verifySiteGeofence(
  siteLat: number,
  siteLng: number,
  userLat: number,
  userLng: number,
  allowedRadiusMeters = 200
): {
  isWithinGeofence: boolean;
  distanceMeters: number;
} {
  const distanceMeters = calculateGpsDistanceMeters(siteLat, siteLng, userLat, userLng);
  return {
    isWithinGeofence: distanceMeters <= allowedRadiusMeters,
    distanceMeters,
  };
}

/**
 * Détecte si un éloignement justifie un incident de déconnexion (> 15 minutes sans autorisation).
 * Conformément au PRD §12.2.
 */
export function detectAbsenceIncident(awayMinutes: number): {
  isIncident: boolean;
  shouldDisconnect: boolean;
} {
  const minutes = Math.max(0, Number(awayMinutes) || 0);
  const exceedsLimit = minutes > 15;
  return {
    isIncident: exceedsLimit,
    shouldDisconnect: exceedsLimit,
  };
}

/**
 * Génère le numéro séquentiel de paie mensuelle : PAY-YYYY-XXXXXX.
 */
export function generateMonthlyPayrollNumber(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `PAY-${year}-${padded}`;
}
