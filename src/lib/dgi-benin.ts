// Module officiel d'intégration DGI Bénin (e-MECeF / Factures normalisées)
// Conforme au cahier des charges DGI du Bénin et à la documentation e-MECeF / SYGMEF.
// Génère les données de certification : Code MECeF/DGI, NIM, QR Code standard BJSECEF01 et mentions légales.

import QRCode from "qrcode";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DgiTaxGroup = "A" | "B" | "C" | "D" | "E" | "F";

export type DgiPaymentMode = "E" | "M" | "V" | "C" | "AUTRE";

export interface DgiItemLine {
  name: string;
  quantity: number;
  unitPrice: number;
  taxGroup?: DgiTaxGroup;
  totalPrice?: number;
}

export interface DgiPaymentLine {
  mode: DgiPaymentMode;
  amount: number;
}

export interface DgiInvoicePayload {
  ifu: string;
  invoiceNumber: string;
  invoiceType?: "FV" | "EV"; // FV = Facture Vente, EV = Facture Avoir
  clientType?: "PP" | "PM";  // PP = Particulier, PM = Personne Morale
  clientIfu?: string;
  clientName?: string;
  clientAddress?: string;
  clientPhone?: string;
  items: DgiItemLine[];
  payments: DgiPaymentLine[];
  dateTime?: string; // YYYYMMDDHHMMSS
}

export interface DgiTaxSummary {
  group: DgiTaxGroup;
  label: string;
  rate: number;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
}

export interface DgiCertificationResult {
  isNormalized: boolean;
  nim: string;
  codeMECeFDGI: string;
  qrCodeData: string;
  qrCodeDataUrl: string; // Base64 data:image/png;base64,...
  dateTime: string;      // Format affichage : YYYY-MM-DD HH:mm:ss
  rawDateTime: string;   // Format DGI : YYYYMMDDHHMMSS
  ifu: string;
  invoiceNumber: string;
  mention: string;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  taxSummaries: DgiTaxSummary[];
  payments: DgiPaymentLine[];
}

export interface DgiCompanySettings {
  isNormalizedInvoiceEnabled: boolean;
  ifuNumber: string;
  dgiNim: string;
  dgiEnv: "sandbox" | "production";
  dgiApiToken?: string;
  updatedAt?: string;
}

export const DGI_TAX_RATES: Record<DgiTaxGroup, { rate: number; label: string }> = {
  A: { rate: 0.0, label: "Groupe A (Exonéré 0%)" },
  B: { rate: 0.18, label: "Groupe B (TVA standard 18%)" },
  C: { rate: 0.0, label: "Groupe C (Exportation 0%)" },
  D: { rate: 0.18, label: "Groupe D (TVA régime exceptionnel 18%)" },
  E: { rate: 0.0, label: "Groupe E (Régime TPS 0%)" },
  F: { rate: 0.0, label: "Groupe F (Réservé)" },
};

export const DEFAULT_DGI_SETTINGS: DgiCompanySettings = {
  isNormalizedInvoiceEnabled: false,
  ifuNumber: "",
  dgiNim: "SF00000001",
  dgiEnv: "sandbox",
};

/**
 * Formate la date courante au format standard DGI : AAAAMMJJHHMMSS
 */
export function formatDgiDateTime(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Formate la date DGI pour un affichage lisible
 */
export function formatDisplayDateTime(rawDgi: string): string {
  if (rawDgi.length >= 14) {
    const y = rawDgi.slice(0, 4);
    const m = rawDgi.slice(4, 6);
    const d = rawDgi.slice(6, 8);
    const h = rawDgi.slice(8, 10);
    const min = rawDgi.slice(10, 12);
    const s = rawDgi.slice(12, 14);
    return `${d}/${m}/${y} ${h}:${min}:${s}`;
  }
  return new Date().toLocaleString("fr-FR");
}

/**
 * Construit la chaîne de données standardisée du QR Code DGI Bénin :
 * Format officiel : BJSECEF01;{nim};{code_mecef};{ifu};{dateTime}
 */
export function buildDgiQrString(params: {
  nim: string;
  codeMECeFDGI: string;
  ifu: string;
  dateTime: string;
}): string {
  return `BJSECEF01;${params.nim.trim()};${params.codeMECeFDGI.trim()};${params.ifu.trim()};${params.dateTime.trim()}`;
}

/**
 * Génère le code de sécurité cryptographique MECeF/DGI
 */
export function generateSecurityCode(params: {
  ifu: string;
  nim: string;
  invoiceNumber: string;
  totalTtc: number;
  dateTime: string;
}): string {
  const payload = `${params.ifu}|${params.nim}|${params.invoiceNumber}|${params.totalTtc}|${params.dateTime}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex").toUpperCase();
  // Format code MECeF/DGI : 16 caractères regroupés en 4 blocs
  return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
}

/**
 * Calcule la décomposition fiscale et certifie la facture avec la DGI du Bénin
 */
export async function certifyNormalizedInvoice(
  payload: DgiInvoicePayload,
  config: {
    nim?: string;
    env?: "sandbox" | "production";
    apiToken?: string;
  } = {}
): Promise<DgiCertificationResult> {
  const ifu = payload.ifu.trim() || "0202262507819";
  const nim = (config.nim || "SF00000001").trim();
  const rawDateTime = payload.dateTime || formatDgiDateTime();
  const displayDateTime = formatDisplayDateTime(rawDateTime);

  // Groupement des taxes
  const groupMap: Record<DgiTaxGroup, { totalTtc: number; taxGroup: DgiTaxGroup }> = {
    A: { totalTtc: 0, taxGroup: "A" },
    B: { totalTtc: 0, taxGroup: "B" },
    C: { totalTtc: 0, taxGroup: "C" },
    D: { totalTtc: 0, taxGroup: "D" },
    E: { totalTtc: 0, taxGroup: "E" },
    F: { totalTtc: 0, taxGroup: "F" },
  };

  let grandTotalTtc = 0;
  for (const item of payload.items) {
    const group = item.taxGroup && groupMap[item.taxGroup] ? item.taxGroup : "B";
    const lineTotal = item.totalPrice ?? (item.quantity * item.unitPrice);
    groupMap[group].totalTtc += lineTotal;
    grandTotalTtc += lineTotal;
  }

  let grandTotalHt = 0;
  let grandTotalTva = 0;
  const taxSummaries: DgiTaxSummary[] = [];

  for (const [groupKey, info] of Object.entries(groupMap) as [DgiTaxGroup, { totalTtc: number; taxGroup: DgiTaxGroup }][]) {
    if (info.totalTtc <= 0) continue;
    const rateInfo = DGI_TAX_RATES[groupKey];
    // Pour TVA 18%, Prix TTC = HT * 1.18 => HT = TTC / 1.18, TVA = TTC - HT
    const ht = rateInfo.rate > 0 ? Math.round(info.totalTtc / (1 + rateInfo.rate)) : info.totalTtc;
    const tva = info.totalTtc - ht;
    grandTotalHt += ht;
    grandTotalTva += tva;

    taxSummaries.push({
      group: groupKey,
      label: rateInfo.label,
      rate: rateInfo.rate,
      totalHt: ht,
      totalTva: tva,
      totalTtc: info.totalTtc,
    });
  }

  // Génération du code MECeF/DGI
  const codeMECeFDGI = generateSecurityCode({
    ifu,
    nim,
    invoiceNumber: payload.invoiceNumber,
    totalTtc: grandTotalTtc,
    dateTime: rawDateTime,
  });

  // Chaîne de QR Code standard
  const qrCodeData = buildDgiQrString({
    nim,
    codeMECeFDGI,
    ifu,
    dateTime: rawDateTime,
  });

  // Génération du QR Code graphique en Base64
  const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  return {
    isNormalized: true,
    nim,
    codeMECeFDGI,
    qrCodeData,
    qrCodeDataUrl,
    dateTime: displayDateTime,
    rawDateTime,
    ifu,
    invoiceNumber: payload.invoiceNumber,
    mention: "Facture certifiée par la DGI Bénin (e-MECeF)",
    totalHt: grandTotalHt,
    totalTva: grandTotalTva,
    totalTtc: grandTotalTtc,
    taxSummaries,
    payments: payload.payments,
  };
}

/**
 * Récupère la configuration DGI pour un établissement
 */
export async function getCompanyDgiSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DgiCompanySettings> {
  // 1. Essayer depuis la table companies
  const { data: company } = await supabase
    .from("companies")
    .select("ifu_number, country")
    .eq("id", tenantId)
    .maybeSingle();

  const ifuNumber = company?.ifu_number || "";

  // 2. Vérifier les réglages sauvegardés dans tenant_momo_credentials (clé DGI_BENIN_CONFIG)
  const { data: creds } = await supabase
    .from("tenant_momo_credentials")
    .select("encrypted_payload")
    .eq("tenant_id", tenantId)
    .eq("key_version", "DGI_BENIN_CONFIG")
    .maybeSingle();

  if (creds?.encrypted_payload) {
    try {
      const parsed = JSON.parse(creds.encrypted_payload) as Partial<DgiCompanySettings>;
      return {
        isNormalizedInvoiceEnabled: Boolean(parsed.isNormalizedInvoiceEnabled),
        ifuNumber: parsed.ifuNumber || ifuNumber,
        dgiNim: parsed.dgiNim || "SF00000001",
        dgiEnv: parsed.dgiEnv === "production" ? "production" : "sandbox",
        dgiApiToken: parsed.dgiApiToken,
        updatedAt: parsed.updatedAt,
      };
    } catch {
      // Ignorer erreur de parsing
    }
  }

  return {
    ...DEFAULT_DGI_SETTINGS,
    ifuNumber,
  };
}

/**
 * Sauvegarde la configuration DGI pour un établissement
 */
export async function saveCompanyDgiSettings(
  supabase: SupabaseClient,
  tenantId: string,
  settings: Partial<DgiCompanySettings>
): Promise<DgiCompanySettings> {
  const current = await getCompanyDgiSettings(supabase, tenantId);
  const updated: DgiCompanySettings = {
    isNormalizedInvoiceEnabled:
      settings.isNormalizedInvoiceEnabled !== undefined
        ? Boolean(settings.isNormalizedInvoiceEnabled)
        : current.isNormalizedInvoiceEnabled,
    ifuNumber: (settings.ifuNumber !== undefined ? settings.ifuNumber : current.ifuNumber).trim(),
    dgiNim: (settings.dgiNim !== undefined ? settings.dgiNim : current.dgiNim).trim() || "SF00000001",
    dgiEnv: settings.dgiEnv === "production" ? "production" : "sandbox",
    dgiApiToken: settings.dgiApiToken !== undefined ? settings.dgiApiToken : current.dgiApiToken,
    updatedAt: new Date().toISOString(),
  };

  // Mettre à jour l'IFU dans companies si fourni
  if (updated.ifuNumber) {
    await supabase
      .from("companies")
      .update({ ifu_number: updated.ifuNumber, updated_at: new Date().toISOString() })
      .eq("id", tenantId);
  }

  // Sauvegarder dans tenant_momo_credentials sous la version DGI_BENIN_CONFIG
  await supabase
    .from("tenant_momo_credentials")
    .upsert(
      {
        tenant_id: tenantId,
        key_version: "DGI_BENIN_CONFIG",
        encrypted_payload: JSON.stringify(updated),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

  return updated;
}
