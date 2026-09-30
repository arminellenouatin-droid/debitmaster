export const commerceProductImportHeaders = [
  "code_interne",
  "nom",
  "description",
  "categorie",
  "sous_categorie",
  "marque",
  "unite",
  "conditionnements_json",
  "variantes_json",
  "code_barres",
  "reference_fournisseur",
  "fournisseur_principal",
  "prix_achat_xof",
  "prix_vente_detail_xof",
  "prix_vente_semi_gros_xof",
  "prix_vente_gros_xof",
  "tva_pourcentage",
  "stock_minimum",
  "stock_maximum",
  "seuil_reapprovisionnement",
  "suivre_numero_serie",
  "suivre_lot",
  "suivre_date_expiration",
] as const;

export const maxCommerceImportRows = 1000;
export const maxCommerceImportBytes = 5 * 1024 * 1024;

export function parseCommerceCsv(input: string, maxRows = maxCommerceImportRows + 1): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  if (text.includes("\u0000") || text.includes("\uFFFD")) throw new Error("Le fichier CSV n’est pas un texte UTF-8 valide.");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoteClosed = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0 && !quoteClosed) {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
      quoteClosed = false;
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      if (rows.length > maxRows) throw new Error("Le fichier dépasse le nombre maximal de lignes.");
      row = [];
      field = "";
      quoteClosed = false;
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      if (quoteClosed && character.trim() !== "") throw new Error("Le fichier contient un guillemet mal placé.");
      if (!quoteClosed) field += character;
    }
    if (field.length > 10000) throw new Error("Une cellule dépasse la taille autorisée.");
  }

  if (inQuotes) throw new Error("Le fichier contient un champ entre guillemets non terminé.");
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length > maxRows) throw new Error("Le fichier dépasse le nombre maximal de lignes.");
  if (rows.some((values) => values.length > commerceProductImportHeaders.length)) throw new Error("Le fichier contient trop de colonnes.");
  return rows;
}

export function normalizeImportHeader(value: string) {
  return value.trim().toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_");
}

export function parseOptionalInteger(value: unknown, label: string): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/\s/g, "").replace(/,/g, "."));
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} doit être un entier positif ou vide.`);
  return parsed;
}

export function parseOptionalQuantity(value: unknown, label: string): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/\s/g, "").replace(/,/g, "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) throw new Error(`${label} doit être un nombre positif ou vide.`);
  return Math.round(parsed * 1000) / 1000;
}

export function parseOptionalBoolean(value: unknown, label: string): boolean {
  if (value === undefined || value === null || String(value).trim() === "") return false;
  const normalized = String(value).trim().toLocaleLowerCase("fr-FR");
  if (["oui", "true", "1", "yes", "vrai"].includes(normalized)) return true;
  if (["non", "false", "0", "no", "faux"].includes(normalized)) return false;
  throw new Error(`${label} doit être oui ou non.`);
}

export function serializeCommerceCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map((raw) => {
    const value = String(raw ?? "");
    const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }).join(",")).join("\r\n");
}

export function normalizeProductCode(value: unknown, maxLength = 50): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function isCommerceImagePath(value: unknown, tenantId: string) {
  return typeof value === "string" && new RegExp(`^${tenantId}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`, "i").test(value);
}
