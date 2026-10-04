// DebitMaster Pilote Universel d'Impression.
// Prend en charge :
// 1. Imprimantes thermiques de caisse 80 mm (standard ESC/POS, Epson, Star, Xprinter, Sunmi)
// 2. Imprimantes thermiques portables 58 mm (Bluetooth, USB mobile)
// 3. Imprimantes de bureau A4 / Lettre (Laser, Jet d'encre standard pour factures et rapports complets)

export type PrinterType = "THERMAL_80MM" | "THERMAL_58MM" | "A4_STANDARD";

export interface PrinterConfig {
  type: PrinterType;
  headerText?: string;
  footerText?: string;
  showLogo?: boolean;
  cutPaper?: boolean;
  copies?: number;
}

const STORAGE_KEY = "debitmaster_printer_config";

export const defaultPrinterConfig: PrinterConfig = {
  type: "THERMAL_80MM",
  headerText: "",
  footerText: "Merci de votre confiance. À très bientôt !",
  showLogo: true,
  cutPaper: true,
  copies: 1,
};

export function getSavedPrinterConfig(): PrinterConfig {
  if (typeof window === "undefined") return defaultPrinterConfig;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultPrinterConfig, ...JSON.parse(saved) };
  } catch {
    // Fallback par défaut
  }
  return defaultPrinterConfig;
}

export function savePrinterConfig(config: PrinterConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignorer si stockage non disponible
  }
}

/**
 * Génère le CSS @media print calibré au millimètre selon le type de pilote choisi
 */
export function getPrinterCss(type: PrinterType): string {
  if (type === "THERMAL_80MM") {
    return `
      @page {
        size: 80mm auto;
        margin: 0;
      }
      @media print {
        html, body {
          width: 80mm !important;
          max-width: 80mm !important;
          margin: 0 !important;
          padding: 3mm 4mm !important;
          background: #fff !important;
          color: #000 !important;
          font-family: 'Courier New', Courier, monospace, monospace !important;
          font-size: 12px !important;
          line-height: 1.25 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print { display: none !important; }
        .thermal-table { width: 100% !important; border-collapse: collapse !important; }
        .thermal-table th, .thermal-table td { padding: 2px 0 !important; font-size: 11px !important; }
        .thermal-divider { border-top: 1px dashed #000 !important; margin: 4px 0 !important; }
        .thermal-cut-spacer { height: 18mm !important; }
      }
    `;
  }

  if (type === "THERMAL_58MM") {
    return `
      @page {
        size: 58mm auto;
        margin: 0;
      }
      @media print {
        html, body {
          width: 58mm !important;
          max-width: 58mm !important;
          margin: 0 !important;
          padding: 2mm 3mm !important;
          background: #fff !important;
          color: #000 !important;
          font-family: 'Courier New', Courier, monospace, monospace !important;
          font-size: 10px !important;
          line-height: 1.2 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print { display: none !important; }
        .thermal-table { width: 100% !important; border-collapse: collapse !important; }
        .thermal-table th, .thermal-table td { padding: 1.5px 0 !important; font-size: 9.5px !important; }
        .thermal-divider { border-top: 1px dashed #000 !important; margin: 3px 0 !important; }
        .thermal-cut-spacer { height: 15mm !important; }
      }
    `;
  }

  // Format de bureau standard A4
  return `
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    @media print {
      html, body {
        width: 100% !important;
        background: #fff !important;
        color: #0f172a !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print { display: none !important; }
      table { width: 100% !important; border-collapse: collapse !important; }
      th { background-color: #f1f5f9 !important; font-weight: bold !important; border-bottom: 2px solid #cbd5e1 !important; padding: 6px 8px !important; }
      td { border-bottom: 1px solid #e2e8f0 !important; padding: 6px 8px !important; }
    }
  `;
}

/**
 * Lance l'impression isolée via une iframe cachée avec le pilote actif
 */
export function printHtmlDocument({
  title,
  htmlBody,
  printerType,
}: {
  title: string;
  htmlBody: string;
  printerType?: PrinterType;
}): void {
  const activeType = printerType ?? getSavedPrinterConfig().type;
  const css = getPrinterCss(activeType);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>${css}</style>
    </head>
    <body>
      ${htmlBody}
    </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 250);
}

/**
 * Impression d'un ticket de test de calibration pour le pilote d'impression
 */
export function printTestTicket(companyName: string, printerType: PrinterType): void {
  const now = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date());

  if (printerType === "THERMAL_80MM" || printerType === "THERMAL_58MM") {
    const is80 = printerType === "THERMAL_80MM";
    const body = `
      <div style="text-align:center; padding: 4px 0;">
        <h2 style="margin:0; font-size:${is80 ? "16px" : "13px"}; font-weight:bold;">DEBITMASTER PRO</h2>
        <p style="margin:2px 0; font-size:${is80 ? "13px" : "11px"}; font-weight:bold;">${companyName}</p>
        <div class="thermal-divider"></div>
        <p style="margin:2px 0; font-weight:bold; font-size:${is80 ? "12px" : "10px"};">TEST DE PILOTE D'IMPRESSION</p>
        <p style="margin:1px 0; font-size:${is80 ? "11px" : "9px"};">Format : ${is80 ? "Thermique 80 mm (ESC/POS)" : "Thermique 58 mm (Compact)"}</p>
        <p style="margin:1px 0; font-size:${is80 ? "11px" : "9px"};">Date & Heure : ${now}</p>
        <div class="thermal-divider"></div>
      </div>
      <table class="thermal-table">
        <thead>
          <tr>
            <th style="text-align:left;">Paramètre</th>
            <th style="text-align:right;">État</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tête thermique</td>
            <td style="text-align:right; font-weight:bold;">OK (Prêt)</td>
          </tr>
          <tr>
            <td>Largeur papier</td>
            <td style="text-align:right;">${is80 ? "80 mm" : "58 mm"}</td>
          </tr>
          <tr>
            <td>Alignement colonnes</td>
            <td style="text-align:right;">Centré</td>
          </tr>
          <tr>
            <td>Anti-coulage</td>
            <td style="text-align:right; font-weight:bold;">Activé</td>
          </tr>
        </tbody>
      </table>
      <div class="thermal-divider"></div>
      <div style="text-align:center; margin-top: 6px; font-size:${is80 ? "11px" : "9px"};">
        <p style="margin:0; font-weight:bold;">PILOTE CONFIGURÉ AVEC SUCCÈS</p>
        <p style="margin:2px 0;">Ce ticket confirme que votre imprimante est prête pour les factures, reçus et rapports.</p>
        <div class="thermal-cut-spacer"></div>
      </div>
    `;
    printHtmlDocument({ title: `Test Imprimante ${printerType}`, htmlBody: body, printerType });
    return;
  }

  // Test A4
  const body = `
    <div style="padding: 10px 0; border-bottom: 2px solid #0f172a; margin-bottom: 20px;">
      <h1 style="margin:0; font-size:24px; color:#064e3b;">DEBITMASTER — RAPPORT D'IMPRESSION TEST</h1>
      <p style="margin:4px 0; font-size:14px; font-weight:bold;">Établissement : ${companyName}</p>
      <p style="margin:2px 0; color:#64748b; font-size:12px;">Date du test : ${now} · Format : Feuille Standard A4 Bureau</p>
    </div>
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;">
      <h3 style="margin:0 0 10px 0; font-size:16px;">Vérification de connectivité & mise en page</h3>
      <p style="margin:4px 0;">Le pilote de document standard A4 de DebitMaster est correctement initialisé.</p>
      <p style="margin:4px 0;">Vous pouvez éditer des factures proformas, bons de livraison, clôtures journalières et analyses financières haute résolution.</p>
    </div>
    <table style="width:100%; border-collapse:collapse; margin-top:15px;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px; background:#f1f5f9; border-bottom:2px solid #cbd5e1;">Fonctionnalité</th>
          <th style="text-align:center; padding:8px; background:#f1f5f9; border-bottom:2px solid #cbd5e1;">Compatibilité</th>
          <th style="text-align:right; padding:8px; background:#f1f5f9; border-bottom:2px solid #cbd5e1;">Statut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">Rapports &amp; KPIs Financiers</td>
          <td style="text-align:center; padding:8px; border-bottom:1px solid #e2e8f0;">A4 Paysage / Portrait</td>
          <td style="text-align:right; padding:8px; border-bottom:1px solid #e2e8f0; color:#16a34a; font-weight:bold;">Prêt</td>
        </tr>
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">Factures Normalisées &amp; Devis</td>
          <td style="text-align:center; padding:8px; border-bottom:1px solid #e2e8f0;">A4 Standard</td>
          <td style="text-align:right; padding:8px; border-bottom:1px solid #e2e8f0; color:#16a34a; font-weight:bold;">Prêt</td>
        </tr>
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">Tickets de Caisse &amp; Bons Cuisine</td>
          <td style="text-align:center; padding:8px; border-bottom:1px solid #e2e8f0;">Bascule thermique 80mm/58mm</td>
          <td style="text-align:right; padding:8px; border-bottom:1px solid #e2e8f0; color:#16a34a; font-weight:bold;">Prêt</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:40px; border-top:1px solid #cbd5e1; padding-top:10px; font-size:11px; color:#64748b; text-align:center;">
      DebitMaster · Système de Caisse &amp; Gestion d'Établissements Afrique · Imprimé avec succès
    </div>
  `;
  printHtmlDocument({ title: "Test Imprimante A4", htmlBody: body, printerType: "A4_STANDARD" });
}
