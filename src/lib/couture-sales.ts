import type { CoutureGender, CoutureMeasurements } from "@/lib/couture-catalog";

export type CoutureSaleType = "VENTE_SIMPLE" | "COMMANDE" | "CONFECTION" | "RETOUCHE";
export type CoutureSaleStatus = "DRAFT" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "FULFILLED" | "CANCELLED";
export type CoutureSaleItemType = "CLOTHING" | "ACCESSORY" | "CONFECTION_LABOR" | "ALTERATION_SERVICE";
export type CouturePaymentMethod = "CASH" | "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER";

export type CoutureSaleLineInput = {
  itemType: CoutureSaleItemType;
  modelId?: string | null;
  rangeId?: string | null;
  sizeId?: string | null;
  colorId?: string | null;
  accessoryId?: string | null;
  description: string;
  isChild?: boolean;
  quantity: number;
  unitPriceXof: number;
  measurementsSnapshot?: CoutureMeasurements | null;
  fabricProvidedByCustomer?: boolean;
  alterationNotes?: string | null;
};

export type CoutureSaleLine = CoutureSaleLineInput & {
  id: string;
  saleId: string;
  tenantId: string;
  totalPriceXof: number;
};

export type CoutureSale = {
  id: string;
  tenantId: string;
  siteId: string;
  saleNumber: string;
  saleType: CoutureSaleType;
  customerId?: string | null;
  status: CoutureSaleStatus;
  subtotalAmountXof: number;
  discountAmountXof: number;
  totalAmountXof: number;
  paidAmountXof: number;
  balanceAmountXof: number;
  deliveryDeadline?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Génère un numéro séquentiel de vente au format VTE-YYYY-XXXXXX.
 */
export function generateCoutureSaleNumber(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `VTE-${year}-${padded}`;
}

/**
 * Calcule le total d'une ligne de vente.
 */
export function calculateLineTotal(quantity: number, unitPriceXof: number): number {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return 0;
  if (!Number.isSafeInteger(unitPriceXof) || unitPriceXof < 0) return 0;
  return quantity * unitPriceXof;
}

/**
 * Calcule les totaux d'une vente (sous-total, remise, total net, reste à payer).
 */
export function calculateSaleTotals(
  lines: Array<{ quantity: number; unitPriceXof: number }>,
  discountAmountXof = 0,
  paidAmountXof = 0
): {
  subtotalAmountXof: number;
  discountAmountXof: number;
  totalAmountXof: number;
  paidAmountXof: number;
  balanceAmountXof: number;
} {
  const subtotal = lines.reduce((acc, line) => acc + calculateLineTotal(line.quantity, line.unitPriceXof), 0);
  const discount = Math.max(0, Math.min(discountAmountXof, subtotal));
  const total = subtotal - discount;
  const paid = Math.max(0, paidAmountXof);
  const balance = Math.max(0, total - paid);

  return {
    subtotalAmountXof: subtotal,
    discountAmountXof: discount,
    totalAmountXof: total,
    paidAmountXof: paid,
    balanceAmountXof: balance,
  };
}

/**
 * Détermine le statut de règlement en fonction du montant payé.
 */
export function resolvePaymentStatus(totalAmountXof: number, paidAmountXof: number): CoutureSaleStatus {
  if (paidAmountXof >= totalAmountXof && totalAmountXof > 0) return "PAID";
  if (paidAmountXof > 0 && paidAmountXof < totalAmountXof) return "PARTIALLY_PAID";
  return "CONFIRMED";
}
