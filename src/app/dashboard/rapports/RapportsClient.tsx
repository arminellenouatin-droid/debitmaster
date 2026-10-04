"use client";

import { useEffect, useState } from "react";
import { PrinterSettingsModal } from "@/components/PrinterSettingsModal";
import { getSavedPrinterConfig, printHtmlDocument } from "@/lib/printing/printer-driver";

type ABCItem = {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
  cmp: number;
  grossMargin: number;
  marginPercent: number;
  cumulativePercent: number;
  classification: "A" | "B" | "C";
};

type AnalyticsData = {
  range: string;
  startDate: string;
  endDate: string;
  metrics: {
    totalRevenue: number;
    totalCmp: number;
    grossProfit: number;
    grossMarginPercent: number;
    orderCount: number;
    averageBasket: number;
  };
  byDay: Array<{ date: string; revenue: number; orders: number }>;
  bySalesperson: Array<{ sellerName: string; revenue: number; orders: number; percentage: number }>;
  byCategory: Array<{ categoryName: string; revenue: number; percentage: number }>;
  topProducts: ABCItem[];
  abcAnalysis: ABCItem[];
  agedReceivables: {
    total: number;
    under30Days: number;
    between30And60Days: number;
    over60Days: number;
  };
  agedPayables: {
    total: number;
    under30Days: number;
    between30And60Days: number;
    over60Days: number;
  };
};

const formatFCFA = (val: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(val);

export function RapportsClient({
  tenantId,
  companyName,
  userRole = "ADMINISTRATEUR",
}: {
  tenantId: string;
  companyName: string;
  userRole?: string;
}) {
  const [range, setRange] = useState<"today" | "7d" | "30d" | "this_month">("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/commerce/reports/analytics?tenantId=${encodeURIComponent(tenantId)}&range=${range}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Impossible de charger les rapports.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!tenantId) return;
    void loadAnalytics();
  }, [tenantId, range]);

  function exportCSV() {
    if (!data) return;
    const headers = ["Code/ID", "Produit", "Quantite Vendue", "Chiffre d'Affaires (FCFA)", "CMP Total (FCFA)", "Marge Brute (FCFA)", "Marge (%)", "Cumul CA (%)", "Classe ABC"];
    const rows = data.abcAnalysis.map((item) => [
      `"${item.productId}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      item.quantity,
      item.revenue,
      item.cmp,
      item.grossMargin,
      `${item.marginPercent}%`,
      `${item.cumulativePercent}%`,
      item.classification,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rapport_ventes_abc_${tenantId}_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrintReport() {
    if (!data) return;
    const config = getSavedPrinterConfig();
    const rangeLabel =
      range === "today"
        ? "Aujourd'hui"
        : range === "7d"
        ? "7 derniers jours"
        : range === "30d"
        ? "30 derniers jours"
        : "Ce mois";

    if (config.type === "THERMAL_80MM" || config.type === "THERMAL_58MM") {
      const is80 = config.type === "THERMAL_80MM";
      const body = `
        <div style="text-align:center; padding: 4px 0;">
          <h2 style="margin:0; font-size:${is80 ? "16px" : "13px"}; font-weight:bold;">${companyName}</h2>
          <p style="margin:2px 0; font-size:${is80 ? "12px" : "10px"};">RAPPORT D'ACTIVITÉ & VENTES</p>
          <p style="margin:1px 0; font-size:${is80 ? "11px" : "9px"};">Période : ${rangeLabel}</p>
          <p style="margin:1px 0; font-size:${is80 ? "11px" : "9px"};">Généré le : ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</p>
          <div class="thermal-divider"></div>
        </div>
        <table class="thermal-table">
          <tr>
            <td>Chiffre d'Affaires Net :</td>
            <td style="text-align:right; font-weight:bold;">${formatFCFA(data.metrics.totalRevenue)}</td>
          </tr>
          <tr>
            <td>Nombre de Ventes :</td>
            <td style="text-align:right; font-weight:bold;">${data.metrics.orderCount}</td>
          </tr>
          <tr>
            <td>Panier Moyen :</td>
            <td style="text-align:right;">${formatFCFA(data.metrics.averageBasket)}</td>
          </tr>
          <tr>
            <td>Marge Brute :</td>
            <td style="text-align:right; font-weight:bold;">${formatFCFA(data.metrics.grossProfit)} (${data.metrics.grossMarginPercent}%)</td>
          </tr>
        </table>
        <div class="thermal-divider"></div>
        <p style="margin:4px 0 2px 0; font-weight:bold; font-size:${is80 ? "11px" : "9px"};">TOP PRODUITS :</p>
        <table class="thermal-table">
          ${data.abcAnalysis.slice(0, 5).map((p) => `
            <tr>
              <td>${p.name.slice(0, 16)} x${p.quantity}</td>
              <td style="text-align:right;">${formatFCFA(p.revenue)}</td>
            </tr>
          `).join("")}
        </table>
        <div class="thermal-divider"></div>
        <div style="text-align:center; margin-top: 6px; font-size:${is80 ? "11px" : "9px"};">
          <p style="margin:0;">DebitMaster Cloud · Clôture Certifiée</p>
          <div class="thermal-cut-spacer"></div>
        </div>
      `;
      printHtmlDocument({ title: `Rapport-${companyName}`, htmlBody: body, printerType: config.type });
      return;
    }

    // A4 Standard Report
    const body = `
      <div style="padding: 10px 0; border-bottom: 2px solid #0f172a; margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h1 style="margin:0; font-size:24px; color:#0f172a;">${companyName}</h1>
            <p style="margin:4px 0; font-size:14px; color:#475569;">RAPPORT FINANCIER & PERFORMANCE COMMERCIALE</p>
          </div>
          <div style="text-align:right; font-size:12px; color:#64748b;">
            <p style="margin:0;"><strong>Période :</strong> ${rangeLabel}</p>
            <p style="margin:2px 0;"><strong>Date d'édition :</strong> ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</p>
            <p style="margin:2px 0;"><strong>Opérateur :</strong> ${userRole}</p>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <span style="font-size:11px; color:#64748b;">Chiffre d'Affaires Net</span>
          <h2 style="margin:6px 0 0 0; font-size:18px; color:#0f172a;">${formatFCFA(data.metrics.totalRevenue)}</h2>
          <small style="color:#16a34a; font-weight:bold;">${data.metrics.orderCount} commandes</small>
        </div>
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <span style="font-size:11px; color:#64748b;">Coût d'Achat (CMP)</span>
          <h2 style="margin:6px 0 0 0; font-size:18px; color:#334155;">${formatFCFA(data.metrics.totalCmp)}</h2>
          <small style="color:#64748b;">Valorisation stock vendu</small>
        </div>
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <span style="font-size:11px; color:#64748b;">Marge Brute</span>
          <h2 style="margin:6px 0 0 0; font-size:18px; color:#16a34a;">${formatFCFA(data.metrics.grossProfit)}</h2>
          <small style="color:#16a34a; font-weight:bold;">Taux : ${data.metrics.grossMarginPercent}%</small>
        </div>
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <span style="font-size:11px; color:#64748b;">Panier Moyen</span>
          <h2 style="margin:6px 0 0 0; font-size:18px; color:#4f46e5;">${formatFCFA(data.metrics.averageBasket)}</h2>
          <small style="color:#64748b;">Par transaction</small>
        </div>
      </div>

      <h3 style="margin:20px 0 8px 0; font-size:14px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">Classification ABC des Produits (Pareto)</h3>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px; text-align:left;">Classe</th>
            <th style="padding:6px; text-align:left;">Désignation</th>
            <th style="padding:6px; text-align:center;">Qté Vendue</th>
            <th style="padding:6px; text-align:right;">Chiffre d'Affaires</th>
            <th style="padding:6px; text-align:right;">Marge Brute</th>
            <th style="padding:6px; text-align:right;">% Cumulé</th>
          </tr>
        </thead>
        <tbody>
          ${data.abcAnalysis.map((item) => `
            <tr>
              <td style="padding:6px; border-bottom:1px solid #e2e8f0;"><strong>Classe ${item.classification}</strong></td>
              <td style="padding:6px; border-bottom:1px solid #e2e8f0;">${item.name}</td>
              <td style="padding:6px; border-bottom:1px solid #e2e8f0; text-align:center;">${item.quantity}</td>
              <td style="padding:6px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold;">${formatFCFA(item.revenue)}</td>
              <td style="padding:6px; border-bottom:1px solid #e2e8f0; text-align:right; color:#16a34a;">${formatFCFA(item.grossMargin)}</td>
              <td style="padding:6px; border-bottom:1px solid #e2e8f0; text-align:right;">${item.cumulativePercent}%</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div style="margin-top:30px; border-top:1px solid #e2e8f0; padding-top:10px; font-size:11px; color:#64748b; text-align:center;">
        Document édité via DebitMaster Pro · Système d'exploitation et de caisse universel
      </div>
    `;
    printHtmlDocument({ title: `Rapport-${companyName}`, htmlBody: body, printerType: "A4_STANDARD" });
  }

  // Label and badge for role
  const isServerRole = ["SERVEUR", "SERVEUSE", "VENDEUR"].includes(userRole.toUpperCase());
  const isCashierRole = ["CAISSIER", "CAISSIERE"].includes(userRole.toUpperCase());
  const isStockRole = ["MAGASINIER", "APPROVISIONNEMENT", "INVENTAIRE"].includes(userRole.toUpperCase());
  const isKitchenRole = ["CUISINIER", "CHEF_CUISINE", "COMMIS_CUISINE"].includes(userRole.toUpperCase());

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-[var(--line)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--secondary)]">
              {isServerRole
                ? "Espace Service & Ventes"
                : isCashierRole
                ? "Espace Caisse & Encaissements"
                : isStockRole
                ? "Espace Gestion des Stocks"
                : isKitchenRole
                ? "Espace Cuisine & Restauration"
                : "Direction & Pilotage"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              Profil : {userRole}
            </span>
          </div>
          <h1 className="text-2xl font-black text-[var(--primary)] sm:text-3xl">Rapports &amp; KPIs</h1>
          <p className="text-xs text-[var(--muted)]">
            {companyName} · Analyses de rentabilité, suivi des ventes, marges et données opérationnelles adaptées à vos droits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Range filter buttons */}
          <div className="flex rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setRange("today")}
              className={`rounded-lg px-3 py-1.5 transition ${range === "today" ? "bg-[var(--primary)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--primary)]"}`}
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              onClick={() => setRange("7d")}
              className={`rounded-lg px-3 py-1.5 transition ${range === "7d" ? "bg-[var(--primary)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--primary)]"}`}
            >
              7 jours
            </button>
            <button
              type="button"
              onClick={() => setRange("30d")}
              className={`rounded-lg px-3 py-1.5 transition ${range === "30d" ? "bg-[var(--primary)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--primary)]"}`}
            >
              30 jours
            </button>
            <button
              type="button"
              onClick={() => setRange("this_month")}
              className={`rounded-lg px-3 py-1.5 transition ${range === "this_month" ? "bg-[var(--primary)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--primary)]"}`}
            >
              Ce mois
            </button>
          </div>

          <button
            type="button"
            onClick={exportCSV}
            disabled={!data || data.abcAnalysis.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
          >
            <span>📥</span> Exporter CSV
          </button>
          <button
            type="button"
            onClick={handlePrintReport}
            disabled={!data}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-black text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
          >
            <span>🖨</span> Imprimer / PDF
          </button>
          <button
            type="button"
            onClick={() => setShowPrinterModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
            title="Configurer les imprimantes de tickets (80mm/58mm) ou bureau (A4)"
          >
            <span>⚙</span> Pilotes d’imprimante
          </button>
        </div>
      </div>

      <PrinterSettingsModal
        isOpen={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
        companyName={companyName}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="py-16 text-center text-sm font-bold text-[var(--muted)]">
          Calcul des analyses et métriques financières en cours…
        </div>
      ) : data ? (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <span className="text-xs font-bold text-[var(--muted)]">Chiffre d’Affaires Net</span>
              <p className="mt-2 text-2xl font-black text-[var(--primary)]">{formatFCFA(data.metrics.totalRevenue)}</p>
              <p className="mt-1 text-[11px] text-emerald-600 font-bold">{data.metrics.orderCount} ventes encaissées</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <span className="text-xs font-bold text-[var(--muted)]">Coût d’Achat (CMP Total)</span>
              <p className="mt-2 text-2xl font-black text-slate-700">{formatFCFA(data.metrics.totalCmp)}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Valorisation coût de revient</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <span className="text-xs font-bold text-[var(--muted)]">Marge Brute Globale</span>
              <p className="mt-2 text-2xl font-black text-emerald-600">{formatFCFA(data.metrics.grossProfit)}</p>
              <p className="mt-1 text-[11px] font-bold text-emerald-600">Taux de marge : {data.metrics.grossMarginPercent}%</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <span className="text-xs font-bold text-[var(--muted)]">Panier Moyen</span>
              <p className="mt-2 text-2xl font-black text-indigo-600">{formatFCFA(data.metrics.averageBasket)}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Par transaction client</p>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Category breakdown */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <h3 className="text-sm font-black text-[var(--primary)] mb-4">Ventes par Catégorie de Produits</h3>
              {data.byCategory.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">Aucune vente enregistrée sur la période.</p>
              ) : (
                <div className="space-y-3">
                  {data.byCategory.map((cat) => (
                    <div key={cat.categoryName} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{cat.categoryName}</span>
                        <span>{formatFCFA(cat.revenue)} ({cat.percentage}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-teal-600"
                          style={{ width: `${Math.min(100, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Salesperson breakdown */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <h3 className="text-sm font-black text-[var(--primary)] mb-4">Performance par Commercial / Vendeur</h3>
              {data.bySalesperson.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">Aucune vente enregistrée sur la période.</p>
              ) : (
                <div className="space-y-3">
                  {data.bySalesperson.map((seller, idx) => (
                    <div key={seller.sellerName} className="flex items-center justify-between text-xs py-2 border-b border-[var(--line)] last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] font-black text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-[var(--primary)]">{seller.sellerName}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-[var(--primary)]">{formatFCFA(seller.revenue)}</span>
                        <span className="block text-[10px] text-[var(--muted)]">{seller.orders} ventes ({seller.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Aged Receivables & Payables */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-black text-[var(--primary)]">Créances Clients (Balance Âgée)</h3>
                <span className="text-xs font-black text-amber-600">{formatFCFA(data.agedReceivables.total)}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-[var(--surface-muted)]">
                  <span>&lt; 30 jours (Récentes)</span>
                  <span className="font-bold">{formatFCFA(data.agedReceivables.under30Days)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[var(--surface-muted)]">
                  <span>30 à 60 jours (À relancer)</span>
                  <span className="font-bold text-amber-600">{formatFCFA(data.agedReceivables.between30And60Days)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[var(--surface-muted)]">
                  <span>&gt; 60 jours (Critiques / En retard)</span>
                  <span className="font-bold text-red-600">{formatFCFA(data.agedReceivables.over60Days)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-black text-[var(--primary)]">Dettes Fournisseurs (Échéancier)</h3>
                <span className="text-xs font-black text-slate-700">{formatFCFA(data.agedPayables.total)}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-[var(--surface-muted)]">
                  <span>&lt; 30 jours (Non échues)</span>
                  <span className="font-bold">{formatFCFA(data.agedPayables.under30Days)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[var(--surface-muted)]">
                  <span>30 à 60 jours</span>
                  <span className="font-bold text-amber-600">{formatFCFA(data.agedPayables.between30And60Days)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[var(--surface-muted)]">
                  <span>&gt; 60 jours (Urgentes)</span>
                  <span className="font-bold text-red-600">{formatFCFA(data.agedPayables.over60Days)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ABC Pareto Analysis */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[var(--line)] bg-[var(--surface-muted)]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-[var(--primary)]">Analyse ABC des Produits (Loi de Pareto)</h3>
                <p className="text-[11px] text-[var(--muted)]">
                  Classe A (80% du CA · Coeur stratégique) | Classe B (15% du CA) | Classe C (5% du CA · Produits dormants / faible rotation)
                </p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                {data.abcAnalysis.length} articles référencés
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surface-muted)]/20 text-[var(--muted)] font-black uppercase text-[10px]">
                    <th className="p-3.5">Classe</th>
                    <th className="p-3.5">Désignation</th>
                    <th className="p-3.5">Quantité vendue</th>
                    <th className="p-3.5">Chiffre d’Affaires</th>
                    <th className="p-3.5">Coût Achat (CMP)</th>
                    <th className="p-3.5">Marge Brute</th>
                    <th className="p-3.5">Taux Marge</th>
                    <th className="p-3.5 text-right">% Cumulé CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {data.abcAnalysis.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-[var(--muted)]">
                        Aucun mouvement de vente pour construire la classification ABC.
                      </td>
                    </tr>
                  ) : (
                    data.abcAnalysis.map((item) => (
                      <tr key={item.productId} className="hover:bg-[var(--accent-soft)]/20 transition">
                        <td className="p-3.5">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black ${
                              item.classification === "A"
                                ? "bg-emerald-600 text-white"
                                : item.classification === "B"
                                ? "bg-amber-500 text-white"
                                : "bg-slate-400 text-white"
                            }`}
                          >
                            Classe {item.classification}
                          </span>
                        </td>
                        <td className="p-3.5 font-black text-[var(--primary)]">{item.name}</td>
                        <td className="p-3.5 font-bold">{item.quantity}</td>
                        <td className="p-3.5 font-black text-[var(--primary)]">{formatFCFA(item.revenue)}</td>
                        <td className="p-3.5 text-[var(--muted)]">{formatFCFA(item.cmp)}</td>
                        <td className="p-3.5 font-bold text-emerald-600">{formatFCFA(item.grossMargin)}</td>
                        <td className="p-3.5 font-bold text-emerald-700">{item.marginPercent}%</td>
                        <td className="p-3.5 text-right font-black text-[var(--primary)]">{item.cumulativePercent}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
