export type CoutureSupplyCategory =
  | "FABRIC"
  | "THREAD"
  | "BUTTON"
  | "ZIPPER"
  | "LINING"
  | "ACCESSORY_HARDWARE"
  | "PACKAGING"
  | "OTHER";

export type PurchaseApprovalRoute = "SINGLE_ACCOUNTANT" | "THREE_STEP";

export const PURCHASE_APPROVAL_THRESHOLD_XOF = 50_000;
export const PETTY_CASH_DEFAULT_FUND_XOF = 20_000;
export const PETTY_CASH_MAX_EXPENSE_XOF = 2_000;

/**
 * Détermine le circuit de validation d'achat selon le seuil strict de 50 000 FCFA.
 * - < 50 000 FCFA : validation du comptable seul suffit.
 * - >= 50 000 FCFA : avis acheteur -> validation comptable -> accord final direction/RH.
 */
export function determinePurchaseApprovalRoute(totalAmountXof: number): PurchaseApprovalRoute {
  if (totalAmountXof < PURCHASE_APPROVAL_THRESHOLD_XOF) {
    return "SINGLE_ACCOUNTANT";
  }
  return "THREE_STEP";
}

/**
 * Génère le numéro séquentiel d'une demande d'achat : DA-YYYY-XXXXXX.
 */
export function generatePurchaseRequestNumber(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `DA-${year}-${padded}`;
}

/**
 * Génère le numéro séquentiel d'une dépense de petite caisse : PC-YYYY-XXXXXX.
 */
export function generatePettyCashExpenseNumber(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `PC-${year}-${padded}`;
}

export type PettyCashValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * Valide les contraintes strictes d'une dépense de petite caisse d'atelier :
 * - Plafond de 2 000 FCFA par facture
 * - Solde disponible suffisant dans le fonds
 */
export function validatePettyCashExpense(
  currentBalanceXof: number,
  expenseAmountXof: number
): PettyCashValidationResult {
  if (!Number.isSafeInteger(expenseAmountXof) || expenseAmountXof <= 0) {
    return { isValid: false, error: "Le montant de la dépense doit être supérieur à 0 FCFA." };
  }

  if (expenseAmountXof > PETTY_CASH_MAX_EXPENSE_XOF) {
    return {
      isValid: false,
      error: `Plafond dépassé : le montant maximum autorisé par facture de petite caisse est de ${PETTY_CASH_MAX_EXPENSE_XOF} FCFA.`,
    };
  }

  if (expenseAmountXof > currentBalanceXof) {
    return {
      isValid: false,
      error: `Solde insuffisant dans la petite caisse (${currentBalanceXof} FCFA disponibles). Demandez un renouvellement de fonds.`,
    };
  }

  return { isValid: true };
}

/**
 * Calcule le montant nécessaire pour reconstituer le fonds de petite caisse au plafond (20 000 FCFA).
 */
export function calculatePettyCashReplenishment(
  currentBalanceXof: number,
  fundLimitXof = PETTY_CASH_DEFAULT_FUND_XOF
): number {
  return Math.max(0, fundLimitXof - Math.max(0, currentBalanceXof));
}
