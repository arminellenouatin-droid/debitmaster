export const mealAccompanimentNames = [
  "Riz",
  "Pâte",
  "Frites",
  "Attiéké",
  "Salade composée",
  "Alloco",
] as const;

export const mealAccompanimentOptions = ["Aucun", ...mealAccompanimentNames] as const;
export type MealAccompanimentName = (typeof mealAccompanimentNames)[number];
export type MealAccompanimentOption = (typeof mealAccompanimentOptions)[number];
