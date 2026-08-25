// DebitManager owner cockpit: current-day context, real tenant filters, purchase-cost margin and no invented expense values.
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

type Company = { id: string; name: string; activity_type: string; country: string; currency: string; status: string; trial_ends_at?: string | null; subscription_plan?: string | null; subscription_expires_at?: string | null };
type Overview = {
  company: Company;
  role: string;
  isOwner: boolean;
  period: { range: string; start: string; end: string };
  filters: { servers: { id: string; name: string }[]; zones: { id: string; name: string }[] };
  metrics: { revenue: number; confirmedRevenue: number; orderCount: number; paidOrderCount: number; averageBasket: number; activeEmployees: number; occupiedTables: number; totalTables: number; stockUnits: number; stockValueAtPurchaseCost: number; purchasesValue: number; costOfGoodsSold: number; grossMargin: number; expenses: { available: boolean; total: number } };
  agentPerformance: { name: string; orderCount: number; paidRevenue: number }[];
  dailyRevenue: { date: string; amount: number }[];
  recentOrders: { id: string; order_number?: string; table_label: string | null; location_label?: string | null; status: string; total_amount: number; paidAmount: number; created_at: string }[];
  subscription: { status: string; plan: string | null; trialEndsAt: string | null; expiresAt: string | null };
};

const money = (value: number, currency = "XOF") => `${new Intl.NumberFormat("fr-FR").format(value)} ${currency}`;
const shortDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
const fullDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" });

export function DashboardClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState("BAR_RESTAURANT");
  const [range, setRange] = useState("30d");
  const [serverId, setServerId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ range });
    if (serverId) params.set("serverId", serverId);
    if (zoneId) params.set("zoneId", zoneId);
    if (range === "custom" && startDate) params.set("start", startDate);
    if (range === "custom" && endDate) params.set("end", endDate);
    return params.toString();
  }, [range, serverId, zoneId, startDate, endDate]);

  async function load(tenantId = "") {
    setPending(true); setError("");
    try {
      const companiesResponse = await fetch("/api/companies", { cache: "no-store" });
      const companiesResult = await companiesResponse.json();
      if (!companiesResponse.ok) throw new Error(companiesResult.error);
      const available = (companiesResult.companies ?? []) as Company[];
      setCompanies(available);
      const resolvedTenantId = tenantId || selectedTenantId || available[0]?.id || "";
      setSelectedTenantId(resolvedTenantId);
      if (!resolvedTenantId) return;
      const response = await fetch(`/api/dashboard/overview?${queryString}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setOverview(result as Overview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger le pilotage de l’établissement.");
    } finally { setPending(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selectedTenantId) void load(selectedTenantId); }, [queryString]);
  useLiveRefresh(() => load(selectedTenantId));

  async function selectTenant(tenantId: string) {
    setSelectedTenantId(tenantId); setError("");
    const response = await fetch("/api/companies/active", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Impossible de sélectionner l’établissement."); return; }
    window.location.reload();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      const response = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, activityType }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setName(""); await load(result.company?.id ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Création impossible."); } finally { setSaving(false); }
  }

  const maxDailyRevenue = useMemo(() => Math.max(...(overview?.dailyRevenue.map((point) => point.amount) ?? [0]), 1), [overview]);
  const currency = overview?.company.currency ?? "XOF";

  if (pending && !overview) return <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">Chargement du pilotage…</div>;

  if (!overview || !companies.length) return <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr]"><section className="rounded-2xl bg-[var(--primary)] p-8 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Votre point de départ</p><h2 className="mt-4 max-w-xl text-4xl font-black tracking-[-0.05em]">Créez l’espace qui portera vos opérations.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-white/70">Après cette étape, ce tableau de bord affichera uniquement les données réelles de l’établissement que vous aurez sélectionné.</p></section><section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7"><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Configuration initiale</p><h2 className="mt-3 text-2xl font-black text-[var(--primary)]">Créer un établissement</h2><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold">Nom de l’établissement<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4" /></label><label className="block text-sm font-bold">Type<select value={activityType} onChange={(event) => setActivityType(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4"><option value="BUVETTE">Buvette</option><option value="BAR_RESTAURANT">Bar restaurant</option><option value="NIGHTCLUB_LOUNGE">Nightclub / lounge</option></select></label><button disabled={saving} className="w-full rounded-full bg-[var(--primary)] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Création…" : "Créer l’établissement"}</button></form></section>{error && <p role="alert" className="lg:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}</div>;

  const { metrics, subscription, agentPerformance, dailyRevenue, recentOrders } = overview;
  return <div className="space-y-7">
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
    <section className="flex flex-col justify-between gap-5 rounded-2xl bg-[var(--primary)] p-6 text-white shadow-[0_24px_70px_-44px_var(--primary)] sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Établissement actif</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">{overview.company.name}</h2><p className="mt-2 text-sm text-white/65">{overview.company.activity_type.replaceAll("_", " ")} · {overview.company.country} · {currency}</p><p className="mt-3 text-xs font-bold text-white/70">{fullDate.format(new Date())}</p></div><div className="flex flex-col gap-3 sm:items-end"><label className="text-xs font-bold text-white/60">Changer d’établissement<select value={selectedTenantId} onChange={(event) => void selectTenant(event.target.value)} className="mt-1 block min-w-56 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white"><option className="text-[var(--primary)]" value={selectedTenantId}>{overview.company.name}</option>{companies.filter((company) => company.id !== selectedTenantId).map((company) => <option className="text-[var(--primary)]" key={company.id} value={company.id}>{company.name}</option>)}</select></label></div></section>
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Période d’analyse</p><h3 className="mt-2 text-xl font-black text-[var(--primary)]">Filtrer les données réelles</h3></div><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5"><label className="text-xs font-bold text-[var(--muted)]">Période<select value={range} onChange={(event) => setRange(event.target.value)} className="mt-1 h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-bold text-[var(--primary)]"><option value="today">Aujourd’hui</option><option value="7d">7 derniers jours</option><option value="30d">30 derniers jours</option><option value="90d">90 derniers jours</option><option value="custom">Période personnalisée</option></select></label><label className="text-xs font-bold text-[var(--muted)]">Serveur / serveuse<select value={serverId} onChange={(event) => setServerId(event.target.value)} className="mt-1 h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-bold text-[var(--primary)]"><option value="">Tout le personnel</option>{overview.filters.servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}</select></label><label className="text-xs font-bold text-[var(--muted)]">Zone<select value={zoneId} onChange={(event) => setZoneId(event.target.value)} className="mt-1 h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-bold text-[var(--primary)]"><option value="">Toutes les zones</option>{overview.filters.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>{range === "custom" && <label className="text-xs font-bold text-[var(--muted)]">Du<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-bold text-[var(--primary)]" /></label>}{range === "custom" && <label className="text-xs font-bold text-[var(--muted)]">Au<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-bold text-[var(--primary)]" /></label>}</div></div><p className="mt-4 text-xs font-semibold text-[var(--muted)]">Données du {shortDate(overview.period.start)} au {shortDate(overview.period.end)} · actualisation automatique active</p></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Ventes payées", money(metrics.revenue, currency), `${metrics.paidOrderCount} commandes homologuées`], ["Marge brute", money(metrics.grossMargin, currency), `Ventes − coût des stocks vendus`], ["Stock en quantité", metrics.stockUnits.toLocaleString("fr-FR"), "Unités positionnées"], ["Valeur du stock", money(metrics.stockValueAtPurchaseCost, currency), "Au coût d’achat moyen pondéré"], ["Achats", money(metrics.purchasesValue, currency), "Entrées sur la période"], ["Coût des stocks vendus", money(metrics.costOfGoodsSold, currency), "Coût d’achat imputé aux ventes"], ["Panier moyen", money(metrics.averageBasket, currency), "Sur les ventes payées"], ["Présence", `${metrics.activeEmployees} agents`, `${metrics.occupiedTables}/${metrics.totalTables || 0} tables occupées`]].map(([label, value, detail]) => <article key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p><p className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--primary)]">{value}</p><p className="mt-2 text-xs font-semibold text-[var(--muted)]">{detail}</p></article>)}</section>
    <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]"><article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Rythme des ventes payées</p><h3 className="mt-2 text-2xl font-black text-[var(--primary)]">Évolution sur la période</h3></div><span className="text-xs font-bold text-[var(--muted)]">{overview.period.start} → {overview.period.end}</span></div><div className="mt-7 flex h-52 items-end gap-1.5 border-b border-l border-[var(--line)] px-2 pb-0">{dailyRevenue.map((point) => <div key={point.date} className="group relative flex h-full flex-1 items-end"><div title={`${point.date}: ${money(point.amount, currency)}`} className="w-full rounded-t-md bg-[var(--secondary)] transition hover:bg-[var(--primary)]" style={{ height: `${Math.max((point.amount / maxDailyRevenue) * 100, point.amount ? 4 : 1)}%` }} /></div>)}</div><div className="mt-3 flex justify-between text-[10px] font-bold text-[var(--muted)]"><span>{dailyRevenue[0]?.date ?? "—"}</span><span>{dailyRevenue.at(-1)?.date ?? "—"}</span></div></article><article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Classement des ventes</p><h3 className="mt-2 text-2xl font-black text-[var(--primary)]">Meilleures vendeuses / vendeurs</h3><div className="mt-6 space-y-4">{agentPerformance.length ? agentPerformance.map((agent, index) => <div key={agent.name + index} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-black text-[var(--primary)]">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-sm font-bold"><span className="truncate">{agent.name}</span><span>{money(agent.paidRevenue, currency)}</span></div><p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{agent.orderCount} commande{agent.orderCount > 1 ? "s" : ""} payée{agent.orderCount > 1 ? "s" : "e"}</p><div className="mt-2 h-1.5 rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max((agent.paidRevenue / Math.max(agentPerformance[0].paidRevenue, 1)) * 100, 5)}%` }} /></div></div></div>) : <p className="text-sm leading-6 text-[var(--muted)]">Le classement apparaîtra dès qu’une vente payée sera enregistrée.</p>}</div></article></section>
    <section className="grid gap-6 xl:grid-cols-[1fr_0.72fr]"><article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Flux récent</p><h3 className="mt-2 text-2xl font-black text-[var(--primary)]">Dernières commandes de la période</h3></div><a href="/dashboard/orders" className="text-sm font-black text-[var(--primary)] underline decoration-[var(--secondary)] underline-offset-4">Ouvrir les commandes</a></div><div className="mt-5 divide-y divide-[var(--line)]">{recentOrders.length ? recentOrders.map((order) => <div key={order.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-black text-[var(--primary)]">{order.order_number ?? order.id.slice(0, 8)}</p><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{order.location_label || order.table_label || "Sans emplacement"} · {order.status} · payé {money(order.paidAmount, currency)}</p></div><span className="shrink-0 text-sm font-black text-[var(--primary)]">{money(order.total_amount, currency)}</span></div>) : <p className="py-5 text-sm text-[var(--muted)]">Aucune commande sur la période sélectionnée.</p>}</div></article><article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Abonnement</p><h3 className="mt-2 text-2xl font-black text-[var(--primary)]">{subscription.status}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{subscription.plan ? `Formule ${subscription.plan}` : "Aucune formule payée enregistrée"}{subscription.expiresAt ? ` · jusqu’au ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(subscription.expiresAt))}` : ""}</p><p className="mt-3 text-xs leading-5 text-[var(--muted)]">Dépenses : {metrics.expenses.available ? money(metrics.expenses.total, currency) : "module non configuré"}.</p>{overview.isOwner && <div className="mt-6 flex flex-wrap gap-3"><a href="/dashboard/settings#plans" className="rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-black text-white">Gérer l’abonnement</a></div>}</article></section>
  </div>;
}
