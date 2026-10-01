export type CommerceStockMovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idempotencyPattern = /^[a-z0-9:_-]{8,128}$/i;

function recordValue(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Les données de stock sont invalides.");
  return input as Record<string, unknown>;
}

function requiredUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Error(`${label} invalide.`);
  return value;
}

function parseQuantity(value: unknown, label: string, signed = false) {
  if (typeof value !== "number" && typeof value !== "string") throw new Error(`${label} invalide.`);
  const raw = Number(String(value).trim().replace(/\s/g, "").replace(/,/g, "."));
  if (!Number.isFinite(raw) || Math.abs(raw) > 1_000_000_000 || (!signed && raw <= 0)) {
    throw new Error(`${label} doit être ${signed ? "différente de zéro" : "supérieure à zéro"}.`);
  }
  const rounded = Math.round(raw * 1000) / 1000;
  if (rounded === 0) throw new Error(`${label} doit représenter au moins 0,001 unité.`);
  return rounded;
}

function optionalLabel(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) throw new Error(`${label} dépasse la taille autorisée.`);
  return value.trim();
}

function requiredReason(value: unknown, label = "Motif", maxLength = 500) {
  if (typeof value !== "string") throw new Error(`${label} requis.`);
  const reason = value.trim();
  if (reason.length < 3 || reason.length > maxLength) throw new Error(`${label} doit contenir de 3 à ${maxLength} caractères.`);
  return reason;
}

function requiredIdempotencyKey(value: unknown) {
  if (typeof value !== "string" || !idempotencyPattern.test(value)) throw new Error("Clé de requête invalide. Réessayez l’opération.");
  return value;
}

export function validateCommerceStockMovement(input: unknown) {
  const value = recordValue(input);
  const movementType = value.movementType;
  if (movementType !== "RECEIPT" && movementType !== "ISSUE" && movementType !== "ADJUSTMENT") {
    throw new Error("Type de mouvement invalide.");
  }
  const quantity = parseQuantity(value.quantity, "Quantité", movementType === "ADJUSTMENT");
  if (movementType !== "ADJUSTMENT" && quantity <= 0) throw new Error("La quantité doit être positive.");
  return {
    tenantId: requiredUuid(value.tenantId, "Établissement"),
    storeId: requiredUuid(value.storeId, "Magasin"),
    productId: requiredUuid(value.productId, "Produit"),
    movementType: movementType as CommerceStockMovementType,
    quantity,
    reason: requiredReason(value.reason),
    referenceLabel: optionalLabel(value.referenceLabel, "Référence", 200),
    idempotencyKey: requiredIdempotencyKey(value.idempotencyKey),
  };
}

export function validateCommerceStockReservation(input: unknown) {
  const value = recordValue(input);
  return {
    tenantId: requiredUuid(value.tenantId, "Établissement"),
    storeId: requiredUuid(value.storeId, "Magasin"),
    productId: requiredUuid(value.productId, "Produit"),
    quantity: parseQuantity(value.quantity, "Quantité"),
    referenceLabel: optionalLabel(value.referenceLabel, "Référence", 200),
    idempotencyKey: requiredIdempotencyKey(value.idempotencyKey),
  };
}

export function validateCommerceStockRelease(input: unknown) {
  const value = recordValue(input);
  return {
    tenantId: requiredUuid(value.tenantId, "Établissement"),
    reason: requiredReason(value.reason, "Motif de libération", 300),
  };
}

export function validateCommerceStockSettings(input: unknown) {
  const value = recordValue(input);
  if (typeof value.allowNegativeStock !== "boolean") throw new Error("Le réglage de stock négatif est invalide.");
  const reservationDurationHours = Number(value.reservationDurationHours);
  if (!Number.isInteger(reservationDurationHours) || reservationDurationHours < 1 || reservationDurationHours > 168) {
    throw new Error("La durée de réservation doit être comprise entre 1 et 168 heures.");
  }
  return {
    tenantId: requiredUuid(value.tenantId, "Établissement"),
    allowNegativeStock: value.allowNegativeStock,
    reservationDurationMinutes: reservationDurationHours * 60,
  };
}

export function isValidCommerceStockUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function canAccessCommerceStore(context: { isOwner: boolean; storeIds: string[] }, storeId: string) {
  return context.isOwner || context.storeIds.includes(storeId);
}

export function safeCommerceStockSearch(value: string | null) {
  return (value ?? "").trim().slice(0, 80).replace(/[(),%*\\]/g, " ").replace(/\s+/g, " ").trim();
}

export function commerceStockRpcError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? "";
  if (message.includes("stock_insufficient")) return { status: 409, message: "La quantité disponible est insuffisante." };
  if (message.includes("stock_reserved_quantity")) return { status: 409, message: "La quantité ne peut pas passer sous le niveau réservé." };
  if (message.includes("stock_idempotency_conflict")) return { status: 409, message: "Cette clé de requête a déjà été utilisée pour une autre opération." };
  if (message.includes("stock_reservation_not_releasable")) return { status: 409, message: "Cette réservation n’est plus libérable." };
  if (message.includes("commerce_stock_forbidden") || message.includes("commerce_stock_owner_required")) return { status: 403, message: "Cette opération Stock n’est pas autorisée." };
  if (message.includes("commerce_stock_read_only")) return { status: 402, message: "Les modifications sont suspendues pour cet abonnement." };
  if (message.includes("commerce_store_not_active") || message.includes("commerce_product_not_available") || message.includes("stock_reservation_not_found")) {
    return { status: 404, message: "Le magasin, le produit ou la réservation n’est plus disponible." };
  }
  if (message.includes("invalid_stock") || message.includes("invalid_commerce")) return { status: 400, message: "Les données de l’opération Stock sont invalides." };
  return { status: 500, message: "Impossible d’enregistrer l’opération Stock pour le moment." };
}
