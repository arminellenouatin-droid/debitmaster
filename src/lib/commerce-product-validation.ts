import { isCommerceImagePath, parseOptionalInteger, parseOptionalQuantity } from "@/lib/commerce-catalog";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const optionalText = (value: unknown, max: number, label: string): string | null => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw new Error(`${label} est trop long.`);
  return value.trim();
};
const requiredText = (value: unknown, min: number, max: number, label: string): string => {
  if (typeof value !== "string") throw new Error(`${label} est requis.`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new Error(`${label} doit contenir de ${min} à ${max} caractères.`);
  return result;
};
const optionalMoney = (value: unknown, label: string): number | null => parseOptionalInteger(value, label);

export type CommerceProductDraft = {
  categoryId: string;
  primarySupplierId: string | null;
  internalCode: string;
  barcode: string | null;
  supplierReference: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  baseUnit: string;
  packages: Array<{ label: string; quantity: number }>;
  variants: Array<{ name: string; options: string[] }>;
  photoPaths: string[];
  purchasePriceXof: number | null;
  priceRetailXof: number;
  priceSemiWholesaleXof: number | null;
  priceWholesaleXof: number | null;
  taxRateBasisPoints: number;
  minStock: number;
  maxStock: number | null;
  reorderPoint: number;
  trackSerial: boolean;
  trackLot: boolean;
  trackExpiry: boolean;
};

export function validateCommerceProductDraft(input: unknown, tenantId: string): CommerceProductDraft {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Fiche produit invalide.");
  const value = input as Record<string, unknown>;
  const categoryId = requiredText(value.categoryId, 36, 36, "Catégorie");
  if (!uuidPattern.test(categoryId)) throw new Error("Choisissez une catégorie valide.");
  const primarySupplierId = optionalText(value.primarySupplierId, 36, "Fournisseur");
  if (primarySupplierId && !uuidPattern.test(primarySupplierId)) throw new Error("Choisissez un fournisseur valide.");
  const internalCode = requiredText(value.internalCode, 1, 50, "Code interne");
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,49}$/u.test(internalCode)) throw new Error("Le code interne contient des caractères non autorisés.");
  const barcode = optionalText(value.barcode, 80, "Code-barres");
  const supplierReference = optionalText(value.supplierReference, 80, "Référence fournisseur");
  const name = requiredText(value.name, 2, 180, "Nom du produit");
  const description = optionalText(value.description, 2000, "Description");
  const brand = optionalText(value.brand, 100, "Marque");
  const baseUnit = requiredText(value.baseUnit, 1, 30, "Unité de base");

  const packagesInput = value.packages === undefined ? [] : value.packages;
  if (!Array.isArray(packagesInput) || packagesInput.length > 30) throw new Error("Les conditionnements sont invalides.");
  const packages = packagesInput.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Conditionnement ${index + 1} invalide.`);
    const record = item as Record<string, unknown>;
    const label = requiredText(record.label, 1, 50, `Nom du conditionnement ${index + 1}`);
    const quantity = Number(record.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000) throw new Error(`La conversion du conditionnement ${index + 1} doit être positive.`);
    return { label, quantity: Math.round(quantity * 1000) / 1000 };
  });

  const variantsInput = value.variants === undefined ? [] : value.variants;
  if (!Array.isArray(variantsInput) || variantsInput.length > 20) throw new Error("Les variantes sont invalides.");
  const variants = variantsInput.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Variante ${index + 1} invalide.`);
    const record = item as Record<string, unknown>;
    const variantName = requiredText(record.name, 1, 50, `Nom de la variante ${index + 1}`);
    if (!Array.isArray(record.options) || record.options.length < 1 || record.options.length > 30) throw new Error(`Ajoutez de 1 à 30 options à la variante ${index + 1}.`);
    const options = [...new Set(record.options.map((option) => requiredText(option, 1, 80, "Option de variante")))];
    return { name: variantName, options };
  });

  const photoInput = value.photoPaths === undefined ? [] : value.photoPaths;
  if (!Array.isArray(photoInput) || photoInput.length > 5 || photoInput.some((path) => !isCommerceImagePath(path, tenantId))) {
    throw new Error("Les photos doivent être téléversées depuis cet établissement et ne pas dépasser cinq fichiers.");
  }
  const purchasePriceXof = optionalMoney(value.purchasePriceXof, "Prix d’achat");
  const priceRetailXof = optionalMoney(value.priceRetailXof, "Prix de vente au détail");
  if (priceRetailXof === null) throw new Error("Le prix de vente au détail en XOF est requis.");
  const priceSemiWholesaleXof = optionalMoney(value.priceSemiWholesaleXof, "Prix semi-gros");
  const priceWholesaleXof = optionalMoney(value.priceWholesaleXof, "Prix de gros");
  const taxRatePercent = value.taxRatePercent === undefined || value.taxRatePercent === null || String(value.taxRatePercent).trim() === "" ? 0 : Number(value.taxRatePercent);
  if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) throw new Error("Le taux de TVA doit être compris entre 0 et 100 %.");
  const minStock = parseOptionalQuantity(value.minStock ?? 0, "Stock minimum") ?? 0;
  const maxStock = parseOptionalQuantity(value.maxStock, "Stock maximum");
  const reorderPoint = parseOptionalQuantity(value.reorderPoint ?? 0, "Seuil de réapprovisionnement") ?? 0;
  if (maxStock !== null && maxStock < minStock) throw new Error("Le stock maximum ne peut pas être inférieur au stock minimum.");
  for (const key of ["trackSerial", "trackLot", "trackExpiry"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") throw new Error("Les options de suivi produit sont invalides.");
  }

  return {
    categoryId,
    primarySupplierId,
    internalCode,
    barcode,
    supplierReference,
    name,
    description,
    brand,
    baseUnit,
    packages,
    variants,
    photoPaths: photoInput as string[],
    purchasePriceXof,
    priceRetailXof,
    priceSemiWholesaleXof,
    priceWholesaleXof,
    taxRateBasisPoints: Math.round(taxRatePercent * 100),
    minStock,
    maxStock,
    reorderPoint,
    trackSerial: value.trackSerial === true,
    trackLot: value.trackLot === true,
    trackExpiry: value.trackExpiry === true,
  };
}
