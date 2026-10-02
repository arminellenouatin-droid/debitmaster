export type ParetoItemInput = {
  id: string;
  label: string;
  revenueXof: number;
};

export type ParetoClass = "A" | "B" | "C";

export type ParetoItemResult = {
  id: string;
  label: string;
  revenueXof: number;
  percentageOfTotal: number;
  cumulativePercentage: number;
  classification: ParetoClass;
};

export type ParetoAbcReport = {
  totalRevenueXof: number;
  itemsCount: number;
  classACount: number;
  classBCount: number;
  classCCount: number;
  items: ParetoItemResult[];
};

/**
 * Calcule la classification ABC (Loi de Pareto) sur une liste de ventes :
 * - Classe A : Les produits réalisant les premiers 80 % du CA cumulé (coeur de gamme).
 * - Classe B : Les produits réalisant les 15 % suivants (80 % à 95 %).
 * - Classe C : Les produits de faible rotation réalisant les 5 % restants (95 % à 100 %).
 */
export function calculateParetoAbcClassification(items: ParetoItemInput[]): ParetoAbcReport {
  if (items.length === 0) {
    return {
      totalRevenueXof: 0,
      itemsCount: 0,
      classACount: 0,
      classBCount: 0,
      classCCount: 0,
      items: [],
    };
  }

  // Tri par CA décroissant
  const sorted = [...items]
    .map((it) => ({
      ...it,
      revenueXof: Math.max(0, Math.round(Number(it.revenueXof) || 0)),
    }))
    .sort((a, b) => b.revenueXof - a.revenueXof);

  const totalRevenue = sorted.reduce((acc, it) => acc + it.revenueXof, 0);

  if (totalRevenue === 0) {
    return {
      totalRevenueXof: 0,
      itemsCount: sorted.length,
      classACount: 0,
      classBCount: 0,
      classCCount: sorted.length,
      items: sorted.map((it) => ({
        id: it.id,
        label: it.label,
        revenueXof: 0,
        percentageOfTotal: 0,
        cumulativePercentage: 0,
        classification: "C",
      })),
    };
  }

  let cumulativeRevenue = 0;
  let countA = 0;
  let countB = 0;
  let countC = 0;

  const resultItems: ParetoItemResult[] = sorted.map((it) => {
    cumulativeRevenue += it.revenueXof;
    const pct = Math.round((it.revenueXof / totalRevenue) * 10000) / 100;
    const cumulativePct = Math.min(100, Math.round((cumulativeRevenue / totalRevenue) * 10000) / 100);

    let classification: ParetoClass = "C";
    if (cumulativePct <= 80 || (cumulativePct > 80 && cumulativeRevenue - it.revenueXof < totalRevenue * 0.8)) {
      classification = "A";
      countA++;
    } else if (cumulativePct <= 95 || (cumulativePct > 95 && cumulativeRevenue - it.revenueXof < totalRevenue * 0.95)) {
      classification = "B";
      countB++;
    } else {
      classification = "C";
      countC++;
    }

    return {
      id: it.id,
      label: it.label,
      revenueXof: it.revenueXof,
      percentageOfTotal: pct,
      cumulativePercentage: cumulativePct,
      classification,
    };
  });

  return {
    totalRevenueXof: totalRevenue,
    itemsCount: resultItems.length,
    classACount: countA,
    classBCount: countB,
    classCCount: countC,
    items: resultItems,
  };
}

export type CoutureNotificationCategory =
  | "PURCHASE_APPROVAL"
  | "LOW_STOCK"
  | "PRODUCTION_ALERT"
  | "ATTENDANCE_INCIDENT"
  | "PAYROLL_READY"
  | "QC_REJECTED"
  | "GENERAL";

export type CoutureNotificationSeverity = "INFO" | "WARNING" | "URGENT";

export type CoutureNotificationPayload = {
  category: CoutureNotificationCategory;
  severity: CoutureNotificationSeverity;
  title: string;
  message: string;
  linkUrl?: string;
  recipientRole?: string;
};

/**
 * Génère un payload de notification métier standardisé pour l'Atelier de couture.
 */
export function buildCoutureNotification(params: {
  category: CoutureNotificationCategory;
  title: string;
  message: string;
  severity?: CoutureNotificationSeverity;
  linkUrl?: string;
  recipientRole?: string;
}): CoutureNotificationPayload {
  return {
    category: params.category,
    severity: params.severity || "INFO",
    title: params.title.trim().slice(0, 160),
    message: params.message.trim().slice(0, 600),
    linkUrl: params.linkUrl || undefined,
    recipientRole: params.recipientRole || undefined,
  };
}
