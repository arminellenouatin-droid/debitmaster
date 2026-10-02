export type CoutureTransferStatus = "DRAFT" | "IN_TRANSIT" | "RECEIVED" | "DISCREPANCY" | "CANCELLED";
export type CoutureInventoryStatus = "IN_PROGRESS" | "COMPLETED" | "VALIDATED" | "CANCELLED";
export type CoutureTransferType = "ATELIER_TO_BOUTIQUE" | "BOUTIQUE_TO_BOUTIQUE" | "BOUTIQUE_TO_ATELIER" | "ATELIER_TO_ATELIER";

/**
 * Génère le numéro séquentiel de transfert : TRF-YYYY-XXXXXX.
 */
export function generateCoutureTransferNumber(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `TRF-${year}-${padded}`;
}

/**
 * Génère le numéro séquentiel d'inventaire physique : INV-YYYY-XXXXXX.
 */
export function generateCoutureInventoryNumber(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `INV-${year}-${padded}`;
}

export type InventoryVarianceResult = {
  theoreticalQuantity: number;
  countedQuantity: number;
  varianceQuantity: number; // counted - theoretical (positif = surplus, négatif = déficit/perte)
  varianceValueXof: number; // varianceQuantity * unitCostXof
  hasDiscrepancy: boolean;
};

/**
 * Calcule l'écart d'inventaire entre le stock théorique et le comptage physique.
 */
export function calculateInventoryVariance(
  theoreticalQuantity: number,
  countedQuantity: number,
  unitCostXof = 0
): InventoryVarianceResult {
  const theo = Math.max(0, Number(theoreticalQuantity) || 0);
  const counted = Math.max(0, Number(countedQuantity) || 0);
  const variance = counted - theo;
  const cost = Math.max(0, Math.round(unitCostXof));
  const varianceValue = Math.round(variance * cost);

  return {
    theoreticalQuantity: theo,
    countedQuantity: counted,
    varianceQuantity: variance,
    varianceValueXof: varianceValue,
    hasDiscrepancy: variance !== 0,
  };
}

export type TransferItemResolution = {
  quantityShipped: number;
  quantityReceived: number;
};

/**
 * Résout le statut final d'un transfert lors de sa réception en destination.
 */
export function resolveTransferReceiptStatus(items: TransferItemResolution[]): CoutureTransferStatus {
  if (items.length === 0) return "RECEIVED";

  let hasDiscrepancy = false;
  for (const item of items) {
    const shipped = Math.max(0, Number(item.quantityShipped) || 0);
    const received = Math.max(0, Number(item.quantityReceived) || 0);
    if (shipped !== received) {
      hasDiscrepancy = true;
      break;
    }
  }

  return hasDiscrepancy ? "DISCREPANCY" : "RECEIVED";
}
