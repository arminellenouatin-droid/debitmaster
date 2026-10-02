export type DistinctionPieceworkTask = {
  taskCode: string;
  taskLabel: string;
  rateWithoutEmbroideryXof: number;
  rateWithEmbroideryXof: number;
};

export const defaultDistinctionPieceworkRates: DistinctionPieceworkTask[] = [
  { taskCode: "CHAPEAU", taskLabel: "Chapeau", rateWithoutEmbroideryXof: 1_000, rateWithEmbroideryXof: 1_000 },
  { taskCode: "AGBADA", taskLabel: "Agbada", rateWithoutEmbroideryXof: 5_000, rateWithEmbroideryXof: 6_000 },
  { taskCode: "HAUT_GOODLUCK", taskLabel: "Haut Goodluck", rateWithoutEmbroideryXof: 1_600, rateWithEmbroideryXof: 3_000 },
  { taskCode: "HAUT_DANSHIKI", taskLabel: "Haut Danshiki", rateWithoutEmbroideryXof: 2_000, rateWithEmbroideryXof: 4_000 },
  { taskCode: "PANTALON_DROIT", taskLabel: "Pantalon droit", rateWithoutEmbroideryXof: 2_000, rateWithEmbroideryXof: 2_000 },
  { taskCode: "PANTALON_SIMPLE", taskLabel: "Pantalon simple", rateWithoutEmbroideryXof: 1_000, rateWithEmbroideryXof: 1_000 },
  { taskCode: "ROBE", taskLabel: "Robe", rateWithoutEmbroideryXof: 3_000, rateWithEmbroideryXof: 3_000 },
  { taskCode: "BOUBOU", taskLabel: "Boubou", rateWithoutEmbroideryXof: 3_000, rateWithEmbroideryXof: 3_000 },
];

/**
 * Calcule la rémunération d'une tâche ouvrière à la tâche (avec majoration 20% si hors horaires).
 */
export function calculateTaskAmount(
  baseRateXof: number,
  isOvertime = false,
  overtimeMultiplier = 1.2
): number {
  if (!Number.isFinite(baseRateXof) || baseRateXof <= 0) return 0;
  if (!isOvertime) return Math.round(baseRateXof);
  return Math.round(baseRateXof * overtimeMultiplier);
}

export type TaskSummaryItem = {
  unitRateXof: number;
  isOvertime: boolean;
  finalAmountXof: number;
};

export type WeeklyPayrollTotals = {
  tasksCount: number;
  baseAmountXof: number;
  overtimeAmountXof: number;
  totalTasksAmountXof: number;
  bonusAmountXof: number;
  deductionAmountXof: number;
  netAmountXof: number;
};

/**
 * Cumule les tâches accomplies pour générer le décompte de paie hebdomadaire de l'ouvrier.
 */
export function computeWeeklyPayrollTotals(
  tasks: TaskSummaryItem[],
  bonusAmountXof = 0,
  deductionAmountXof = 0
): WeeklyPayrollTotals {
  let baseAmount = 0;
  let overtimeExtra = 0;

  for (const t of tasks) {
    const unit = Math.max(0, Math.round(t.unitRateXof));
    const finalAmt = Math.max(0, Math.round(t.finalAmountXof));
    baseAmount += unit;
    if (t.isOvertime && finalAmt > unit) {
      overtimeExtra += finalAmt - unit;
    }
  }

  const bonus = Math.max(0, Math.floor(bonusAmountXof || 0));
  const deduction = Math.max(0, Math.floor(deductionAmountXof || 0));
  const totalTasks = baseAmount + overtimeExtra;
  const net = Math.max(0, totalTasks + bonus - deduction);

  return {
    tasksCount: tasks.length,
    baseAmountXof: baseAmount,
    overtimeAmountXof: overtimeExtra,
    totalTasksAmountXof: totalTasks,
    bonusAmountXof: bonus,
    deductionAmountXof: deduction,
    netAmountXof: net,
  };
}
