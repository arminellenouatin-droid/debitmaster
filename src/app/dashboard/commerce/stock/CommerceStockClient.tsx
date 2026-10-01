"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Store = { id: string; name: string; store_type: string; city?: string | null };
type StockRow = {
  store_id: string;
  store_name: string;
  product_id: string;
  product_name: string;
  internal_code: string | null;
  barcode: string | null;
  base_unit: string;
  product_status: string;
  min_stock: number | string;
  max_stock: number | string | null;
  reorder_point: number | string;
  physical_quantity: number | string;
  reserved_quantity: number | string;
  available_quantity: number | string;
  alert_status: string;
};
type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity_delta: number | string;
  quantity_before: number | string;
  quantity_after: number | string;
  reason: string;
  reference_label: string | null;
  created_at: string;
  product: { name: string; internal_code: string | null; base_unit: string } | null;
};
type Reservation = {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number | string;
  status: string;
  reference_label: string | null;
  expires_at: string;
  created_at: string;
  product: { name: string; internal_code: string | null; base_unit: string } | null;
  store: { name: string } | null;
};
type StockSettings = { allow_negative_stock: boolean; reservation_duration_minutes: number };
type Section = "levels" | "movements" | "reservations" | "settings";
type OperationKey = { signature: string; key: string } | null;

const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2";
const labelClass = "block text-xs font-bold text-[var(--muted)]";
const quantity = (value: unknown) => Number(value ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date inconnue" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
};
const alertLabel: Record<string, string> = {
  OUT_OF_STOCK: "Rupture",
  LOW_STOCK: "À réapprovisionner",
  OVERSTOCK: "Surstock",
  HEALTHY: "Disponible",
};
const alertClass: Record<string, string> = {
  OUT_OF_STOCK: "bg-red-100 text-red-900",
  LOW_STOCK: "bg-amber-100 text-amber-950",
  OVERSTOCK: "bg-sky-100 text-sky-950",
  HEALTHY: "bg-emerald-100 text-emerald-950",
};
const movementLabel: Record<string, string> = { RECEIPT: "Réception", ISSUE: "Sortie", ADJUSTMENT: "Ajustement" };
const reservationLabel: Record<string, string> = { ACTIVE: "Active", RELEASED: "Libérée", EXPIRED: "Expirée", CONSUMED: "Consommée" };

function newOperationKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function CommerceStockClient({ tenantId, isOwner, canWrite, canReceive, canIssue, canManage }: {
  tenantId: string;
  isOwner: boolean;
  canWrite: boolean;
  canReceive: boolean;
  canIssue: boolean;
  canManage: boolean;
}) {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [rows, setRows] = useState<StockRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [alerts, setAlerts] = useState({ outOfStock: 0, lowStock: 0, overstock: 0 });
  const [settings, setSettings] = useState<StockSettings>({ allow_negative_stock: false, reservation_duration_minutes: 1440 });
  const [movements, setMovements] = useState<Movement[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [section, setSection] = useState<Section>("levels");
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [movementForm, setMovementForm] = useState({ movementType: canReceive ? "RECEIPT" : canIssue ? "ISSUE" : "ADJUSTMENT", productId: "", quantity: "", reason: "", referenceLabel: "" });
  const [reservationForm, setReservationForm] = useState({ productId: "", quantity: "", referenceLabel: "" });
  const [settingsForm, setSettingsForm] = useState({ allowNegativeStock: false, reservationDurationHours: "24" });
  const [releaseReasons, setReleaseReasons] = useState<Record<string, string>>({});
  const movementKey = useRef<OperationKey>(null);
  const reservationKey = useRef<OperationKey>(null);
  const stockRequest = useRef(0);
  const movementRequest = useRef(0);
  const reservationRequest = useRef(0);
  const canReceiveWrite = canWrite && canReceive;
  const canIssueWrite = canWrite && canIssue;
  const canManageWrite = canWrite && canManage;
  const movementTypes = [
    ...(canReceiveWrite ? [["RECEIPT", "Réception"]] : []),
    ...(canIssueWrite ? [["ISSUE", "Sortie"]] : []),
    ...(canManageWrite ? [["ADJUSTMENT", "Ajustement signé"]] : []),
  ] as Array<[string, string]>;
  const sections: Array<[Section, string]> = [
    ["levels", "Niveaux et alertes"],
    ["movements", "Mouvements"],
    ["reservations", "Réservations"],
    ...(isOwner ? [["settings", "Réglages"] as [Section, string]] : []),
  ];

  const loadStock = useCallback(async (nextOffset: number) => {
    const requestId = ++stockRequest.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ tenantId, limit: "50", offset: String(nextOffset), status });
      if (storeId) params.set("storeId", storeId);
      if (appliedQuery) params.set("q", appliedQuery);
      const response = await fetch(`/api/commerce/stock?${params}`, { cache: "no-store" });
      const result = await response.json() as { stores?: Store[]; rows?: StockRow[]; total?: number; settings?: StockSettings; alerts?: typeof alerts; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger les stocks.");
      if (requestId !== stockRequest.current) return;
      setStores(result.stores ?? []);
      if (result.settings) {
        setSettings(result.settings);
        setSettingsForm({ allowNegativeStock: result.settings.allow_negative_stock, reservationDurationHours: String(result.settings.reservation_duration_minutes / 60) });
      }
      if (!storeId && result.stores?.[0]) setStoreId(result.stores[0].id);
      setRows(result.rows ?? []);
      setTotal(result.total ?? 0);
      setAlerts(result.alerts ?? { outOfStock: 0, lowStock: 0, overstock: 0 });
      setOffset(nextOffset);
    } catch (cause) {
      if (requestId === stockRequest.current) setError(cause instanceof Error ? cause.message : "Impossible de charger les stocks.");
    } finally {
      if (requestId === stockRequest.current) setLoading(false);
    }
  }, [tenantId, storeId, appliedQuery, status]);

  const loadMovements = useCallback(async () => {
    if (!storeId) return;
    const requestId = ++movementRequest.current;
    setMovementsLoading(true);
    try {
      const params = new URLSearchParams({ tenantId, storeId, limit: "50", offset: "0" });
      const response = await fetch(`/api/commerce/stock/movements?${params}`, { cache: "no-store" });
      const result = await response.json() as { movements?: Movement[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger les mouvements.");
      if (requestId !== movementRequest.current) return;
      setMovements(result.movements ?? []);
    } catch (cause) {
      if (requestId === movementRequest.current) setError(cause instanceof Error ? cause.message : "Impossible de charger les mouvements.");
    } finally {
      if (requestId === movementRequest.current) setMovementsLoading(false);
    }
  }, [tenantId, storeId]);

  const loadReservations = useCallback(async () => {
    if (!storeId) return;
    const requestId = ++reservationRequest.current;
    setReservationsLoading(true);
    try {
      const params = new URLSearchParams({ tenantId, storeId, status: "ACTIVE", limit: "50", offset: "0" });
      const response = await fetch(`/api/commerce/stock/reservations?${params}`, { cache: "no-store" });
      const result = await response.json() as { reservations?: Reservation[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger les réservations.");
      if (requestId !== reservationRequest.current) return;
      setReservations(result.reservations ?? []);
    } catch (cause) {
      if (requestId === reservationRequest.current) setError(cause instanceof Error ? cause.message : "Impossible de charger les réservations.");
    } finally {
      if (requestId === reservationRequest.current) setReservationsLoading(false);
    }
  }, [tenantId, storeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStock(0); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStock]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMovements(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMovements]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReservations(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReservations]);

  function chooseMovement(row?: StockRow, movementType?: string) {
    setMovementForm((current) => ({
      ...current,
      productId: row?.product_id ?? current.productId,
      movementType: movementType ?? current.movementType,
      quantity: "",
      reason: "",
      referenceLabel: "",
    }));
    setSection("movements");
    setError("");
    setMessage("");
  }

  function chooseReservation(row: StockRow) {
    setReservationForm({ productId: row.product_id, quantity: "", referenceLabel: "" });
    setSection("reservations");
    setError("");
    setMessage("");
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId) return;
    setSaving(true); setError(""); setMessage("");
    const payload = { tenantId, storeId, ...movementForm };
    const signature = JSON.stringify(payload);
    if (!movementKey.current || movementKey.current.signature !== signature) movementKey.current = { signature, key: newOperationKey() };
    try {
      const response = await fetch("/api/commerce/stock", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotencyKey: movementKey.current.key }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer le mouvement.");
      movementKey.current = null;
      setMovementForm((current) => ({ ...current, quantity: "", reason: "", referenceLabel: "" }));
      setMessage("Mouvement enregistré et journalisé.");
      await Promise.all([loadStock(offset), loadMovements()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer le mouvement.");
    } finally { setSaving(false); }
  }

  async function saveReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId) return;
    setSaving(true); setError(""); setMessage("");
    const payload = { tenantId, storeId, ...reservationForm };
    const signature = JSON.stringify(payload);
    if (!reservationKey.current || reservationKey.current.signature !== signature) reservationKey.current = { signature, key: newOperationKey() };
    try {
      const response = await fetch("/api/commerce/stock/reservations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotencyKey: reservationKey.current.key }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de réserver le stock.");
      reservationKey.current = null;
      setReservationForm((current) => ({ ...current, quantity: "", referenceLabel: "" }));
      setMessage("Réservation créée avec une date d’expiration.");
      await Promise.all([loadStock(offset), loadReservations()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de réserver le stock.");
    } finally { setSaving(false); }
  }

  async function releaseReservation(event: FormEvent<HTMLFormElement>, reservationId: string) {
    event.preventDefault();
    const reason = releaseReasons[reservationId]?.trim() ?? "";
    if (reason.length < 3) { setError("Indiquez un motif de libération d’au moins 3 caractères."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/commerce/stock/reservations/${reservationId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, reason }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de libérer la réservation.");
      setReleaseReasons((current) => ({ ...current, [reservationId]: "" }));
      setMessage("Réservation libérée et action journalisée.");
      await Promise.all([loadStock(offset), loadReservations()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de libérer la réservation.");
    } finally { setSaving(false); }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/commerce/stock/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...settingsForm, reservationDurationHours: Number(settingsForm.reservationDurationHours) }),
      });
      const result = await response.json() as { settings?: { allowNegativeStock: boolean; reservationDurationMinutes: number }; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer les paramètres.");
      if (result.settings) {
        setSettings({ allow_negative_stock: result.settings.allowNegativeStock, reservation_duration_minutes: result.settings.reservationDurationMinutes });
        setSettingsForm({ allowNegativeStock: result.settings.allowNegativeStock, reservationDurationHours: String(result.settings.reservationDurationMinutes / 60) });
      }
      setMessage("Paramètres Stock enregistrés et journalisés.");
      await loadStock(offset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer les paramètres.");
    } finally { setSaving(false); }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOffset(0);
    setAppliedQuery(query.trim());
  }

  const maxOffset = Math.max(0, Math.ceil(total / 50) * 50 - 50);

  return <div className="space-y-6">
    <header className="rounded-2xl bg-gradient-to-br from-[#063327] to-[#0b7658] p-6 text-white sm:p-8">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Gestion opérationnelle</p>
        <h1 className="mt-2 text-3xl font-black text-wrap-balance">Stock par magasin</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/90">Suivez les quantités physiques, les réservations et les seuils de réapprovisionnement de votre établissement.</p>
      </div>
    </header>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">{error}</p>}
    {message && <p role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950">{message}</p>}

    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5" aria-label="Sélection du magasin et filtres">
      <label className={`${labelClass} sm:min-w-64`}>Magasin actif
        <select className={inputClass} value={storeId} onChange={(event) => { setStoreId(event.target.value); setOffset(0); }} disabled={stores.length === 0}>
          {stores.length === 0 && <option value="">Aucun magasin accessible</option>}
          {stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.city ? ` · ${store.city}` : ""}</option>)}
        </select>
      </label>
      <form onSubmit={submitSearch} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
        <label className={`${labelClass} flex-1`}>Rechercher un produit
          <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={80} placeholder="Nom, code ou code-barres" />
        </label>
        <label className={`${labelClass} sm:min-w-52`}>État du stock
          <select className={inputClass} value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}>
            <option value="ALL">Tous les états</option><option value="OUT_OF_STOCK">Rupture</option><option value="LOW_STOCK">À réapprovisionner</option><option value="OVERSTOCK">Surstock</option><option value="HEALTHY">Disponible</option>
          </select>
        </label>
        <button className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">Filtrer</button>
      </form>
    </section>

    <section aria-label="Synthèse des alertes de stock" className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="text-xs font-bold text-red-900">Ruptures</p><p className="mt-1 text-2xl font-black text-red-950">{alerts.outOfStock.toLocaleString("fr-FR")}</p></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-xs font-bold text-amber-950">À réapprovisionner</p><p className="mt-1 text-2xl font-black text-amber-950">{alerts.lowStock.toLocaleString("fr-FR")}</p></div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3"><p className="text-xs font-bold text-sky-950">Surstocks</p><p className="mt-1 text-2xl font-black text-sky-950">{alerts.overstock.toLocaleString("fr-FR")}</p></div>
    </section>

    <div className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-3" role="group" aria-label="Sections Stock">
      {sections.map(([id, label]) => <button key={id} type="button" aria-pressed={section === id} onClick={() => { setSection(id); setError(""); setMessage(""); }} className={`min-h-11 rounded-xl px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${section === id ? "bg-[var(--primary)] text-white" : "border border-[var(--line)] bg-[var(--surface)] text-[var(--primary)] hover:bg-emerald-50"}`}>{label}</button>)}
    </div>

    {section === "levels" && <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-col gap-2 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h2 className="text-lg font-black">Niveaux disponibles</h2><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{total.toLocaleString("fr-FR")} produit(s), quantités réservées exclues du disponible.</p></div>
        <p className="text-xs font-semibold text-[var(--muted)]">Magasin : {stores.find((store) => store.id === storeId)?.name ?? "à sélectionner"}</p>
      </div>
      {loading ? <div className="space-y-3 p-5" role="status" aria-live="polite"><p className="text-sm font-bold text-[var(--muted)]">Chargement des niveaux de stock…</p><div className="h-10 rounded-lg bg-slate-100"/><div className="h-10 rounded-lg bg-slate-100"/></div>
        : rows.length === 0 ? <div className="px-5 py-14 text-center"><h3 className="text-lg font-black">Aucun produit pour ces filtres</h3><p className="mt-2 text-sm text-[var(--muted)]">Essayez un autre terme ou vérifiez le catalogue Commerce.</p></div>
        : <div className="overflow-x-auto">
          <table className="min-w-[850px] w-full text-left text-sm">
            <caption className="sr-only">Quantités physiques et disponibles par produit au magasin sélectionné</caption>
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-700"><tr><th scope="col" className="px-4 py-3">Produit</th><th scope="col" className="px-4 py-3">Physique</th><th scope="col" className="px-4 py-3">Réservé</th><th scope="col" className="px-4 py-3">Disponible</th><th scope="col" className="px-4 py-3">Seuil d’alerte</th><th scope="col" className="px-4 py-3">État</th><th scope="col" className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => <tr key={row.product_id} className="align-top hover:bg-slate-50/80">
                <th scope="row" className="px-4 py-3 font-semibold"><span className="block text-sm font-black text-[var(--primary)]">{row.product_name}</span><span className="mt-1 block text-xs font-medium text-[var(--muted)]">{row.internal_code || row.barcode || "Sans code"} · {row.base_unit}{row.product_status !== "ACTIVE" && <span className="ml-2 rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-black text-slate-700">Archivé</span>}</span></th>
                <td className="px-4 py-3 font-bold tabular-nums">{quantity(row.physical_quantity)}</td>
                <td className="px-4 py-3 font-semibold tabular-nums">{quantity(row.reserved_quantity)}</td>
                <td className="px-4 py-3 font-black tabular-nums">{quantity(row.available_quantity)}</td>
                <td className="px-4 py-3 text-xs font-semibold text-[var(--muted)]">Minimum {quantity(row.min_stock)} · réappro. {quantity(row.reorder_point)}</td>
                <td className="px-4 py-3"><span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-[11px] font-black ${alertClass[row.alert_status] ?? "bg-slate-100 text-slate-800"}`}>{alertLabel[row.alert_status] ?? "Inconnu"}</span></td>
                <td className="px-4 py-3"><div className="flex min-w-40 flex-wrap gap-1.5">
                  {canReceiveWrite && row.product_status === "ACTIVE" && <button type="button" onClick={() => chooseMovement(row, "RECEIPT")} className="min-h-9 rounded-lg border border-emerald-300 px-2.5 text-xs font-black text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">Réception</button>}
                  {canIssueWrite && <button type="button" onClick={() => chooseMovement(row, "ISSUE")} className="min-h-9 rounded-lg border border-slate-300 px-2.5 text-xs font-black text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">Sortie</button>}
                  {canManageWrite && row.product_status === "ACTIVE" && <button type="button" onClick={() => chooseReservation(row)} className="min-h-9 rounded-lg border border-amber-300 px-2.5 text-xs font-black text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">Réserver</button>}
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 sm:px-5">
        <p className="text-xs font-semibold text-[var(--muted)]">Affichage de {total === 0 ? 0 : offset + 1} à {Math.min(offset + rows.length, total)} sur {total}</p>
        <div className="flex gap-2"><button type="button" disabled={offset === 0 || loading} onClick={() => void loadStock(Math.max(0, offset - 50))} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50">Précédent</button><button type="button" disabled={offset >= maxOffset || loading} onClick={() => void loadStock(Math.min(maxOffset, offset + 50))} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50">Suivant</button></div>
      </div>
    </section>}

    {section === "movements" && <section className="space-y-5">
      {movementTypes.length > 0 && <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
        <div><h2 className="text-lg font-black">Enregistrer un mouvement</h2><p className="mt-1 text-sm text-[var(--muted)]">Chaque mouvement met à jour le solde en une transaction et reste dans le journal.</p></div>
        {!canWrite && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950" role="status">Mode lecture seule. Les mouvements sont désactivés.</p>}
        {canWrite && <form onSubmit={saveMovement} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>Type de mouvement<select className={inputClass} value={movementForm.movementType} onChange={(event) => setMovementForm((current) => ({ ...current, movementType: event.target.value, productId: event.target.value === "RECEIPT" && rows.find((row) => row.product_id === current.productId)?.product_status !== "ACTIVE" ? "" : current.productId }))}>{movementTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={labelClass}>Produit<select required className={inputClass} value={movementForm.productId} onChange={(event) => setMovementForm((current) => ({ ...current, productId: event.target.value }))}><option value="">Choisir un produit affiché</option>{rows.filter((row) => movementForm.movementType !== "RECEIPT" || row.product_status === "ACTIVE").map((row) => <option key={row.product_id} value={row.product_id}>{row.product_name} · {row.internal_code || row.base_unit}</option>)}</select></label>
          <label className={labelClass}>{movementForm.movementType === "ADJUSTMENT" ? "Écart signé" : "Quantité"}<input required type="number" inputMode="decimal" step="0.001" min={movementForm.movementType === "ADJUSTMENT" ? undefined : "0.001"} className={inputClass} value={movementForm.quantity} onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))} aria-describedby="stock-quantity-help" /></label>
          <p id="stock-quantity-help" className="text-xs font-medium text-[var(--muted)] sm:col-span-2 lg:col-span-3">Saisissez une quantité positive pour une réception ou une sortie. Un ajustement peut être positif ou négatif.</p>
          <label className={`${labelClass} sm:col-span-2`}>Motif, obligatoire<input required minLength={3} maxLength={500} className={inputClass} value={movementForm.reason} onChange={(event) => setMovementForm((current) => ({ ...current, reason: event.target.value }))} /></label>
          <label className={labelClass}>Référence, facultative<input maxLength={200} className={inputClass} value={movementForm.referenceLabel} onChange={(event) => setMovementForm((current) => ({ ...current, referenceLabel: event.target.value }))} /></label>
          <div className="flex items-end"><button disabled={saving || !canWrite || !storeId} className="min-h-11 w-full rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer le mouvement"}</button></div>
        </form>}
      </div>}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4"><div><h2 className="text-lg font-black">Journal récent</h2><p className="mt-1 text-xs font-semibold text-[var(--muted)]">Les écritures sont conservées et ne peuvent pas être modifiées.</p></div><button type="button" onClick={() => void loadMovements()} disabled={movementsLoading || !storeId} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black disabled:opacity-50">Actualiser</button></div>
        {movementsLoading ? <p role="status" className="p-5 text-sm font-bold text-[var(--muted)]">Chargement du journal…</p> : movements.length === 0 ? <p className="px-5 py-10 text-center text-sm font-semibold text-[var(--muted)]">Aucun mouvement enregistré pour ce magasin.</p> : <div className="divide-y divide-slate-100">{movements.map((movement) => <article key={movement.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1.4fr_0.8fr_1fr_1.2fr] sm:items-center"><div><p className="font-black">{movement.product?.name ?? "Produit archivé"}</p><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{movement.product?.internal_code || movement.product_id}</p></div><p className="text-sm font-bold">{movementLabel[movement.movement_type] ?? movement.movement_type}: <span className="tabular-nums">{Number(movement.quantity_delta) > 0 ? "+" : ""}{quantity(movement.quantity_delta)} {movement.product?.base_unit ?? "unité(s)"}</span></p><p className="text-xs font-semibold text-[var(--muted)]">Solde : {quantity(movement.quantity_before)} → {quantity(movement.quantity_after)}</p><div><p className="text-sm font-semibold">{movement.reason}</p><p className="mt-1 text-xs text-[var(--muted)]">{dateTime(movement.created_at)}{movement.reference_label ? ` · ${movement.reference_label}` : ""}</p></div></article>)}</div>}
      </div>
    </section>}

    {section === "reservations" && <section className="space-y-5">
      {canManageWrite && <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
        <div><h2 className="text-lg font-black">Réserver une quantité</h2><p className="mt-1 text-sm text-[var(--muted)]">La quantité réservée reste indisponible jusqu’à libération ou expiration.</p></div>
        <form onSubmit={saveReservation} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={`${labelClass} lg:col-span-2`}>Produit<select required className={inputClass} value={reservationForm.productId} onChange={(event) => setReservationForm((current) => ({ ...current, productId: event.target.value }))}><option value="">Choisir un produit affiché</option>{rows.filter((row) => row.product_status === "ACTIVE").map((row) => <option key={row.product_id} value={row.product_id}>{row.product_name} · disponible {quantity(row.available_quantity)} {row.base_unit}</option>)}</select></label>
          <label className={labelClass}>Quantité<input required type="number" inputMode="decimal" step="0.001" min="0.001" className={inputClass} value={reservationForm.quantity} onChange={(event) => setReservationForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
          <label className={labelClass}>Référence facultative<input maxLength={200} className={inputClass} value={reservationForm.referenceLabel} onChange={(event) => setReservationForm((current) => ({ ...current, referenceLabel: event.target.value }))} /></label>
          <div className="sm:col-span-2 lg:col-span-4"><button disabled={saving || !storeId} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Réservation…" : "Créer la réservation"}</button></div>
        </form>
      </div>}
      {!canManageWrite && <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">La création et la libération des réservations sont réservées aux personnes autorisées à gérer le stock.</p>}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4"><div><h2 className="text-lg font-black">Réservations actives</h2><p className="mt-1 text-xs font-semibold text-[var(--muted)]">Durée actuelle : {quantity(settings.reservation_duration_minutes / 60)} heure(s).</p></div><button type="button" onClick={() => void loadReservations()} disabled={reservationsLoading || !storeId} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black disabled:opacity-50">Actualiser</button></div>
        {reservationsLoading ? <p role="status" className="p-5 text-sm font-bold text-[var(--muted)]">Chargement des réservations…</p> : reservations.length === 0 ? <p className="px-5 py-10 text-center text-sm font-semibold text-[var(--muted)]">Aucune réservation active pour ce magasin.</p> : <div className="divide-y divide-slate-100">{reservations.map((reservation) => <article key={reservation.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_0.8fr_1fr_1.6fr] lg:items-center"><div><p className="font-black">{reservation.product?.name ?? "Produit archivé"}</p><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{reservation.product?.internal_code || reservation.product_id} · {reservation.store?.name ?? "Magasin"}</p></div><p className="text-sm font-bold">{quantity(reservation.quantity)} {reservation.product?.base_unit ?? "unité(s)"}</p><div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-950">{reservationLabel[reservation.status] ?? reservation.status}</span><p className="mt-2 text-xs text-[var(--muted)]">Expire le {dateTime(reservation.expires_at)}</p></div>
          {canManageWrite && reservation.status === "ACTIVE" && <form onSubmit={(event) => void releaseReservation(event, reservation.id)} className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className={`${labelClass} flex-1`} htmlFor={`release-reason-${reservation.id}`}>Motif de libération<input id={`release-reason-${reservation.id}`} required minLength={3} maxLength={300} className={inputClass} value={releaseReasons[reservation.id] ?? ""} onChange={(event) => setReleaseReasons((current) => ({ ...current, [reservation.id]: event.target.value }))} /></label><button disabled={saving} className="min-h-11 rounded-xl border border-amber-400 px-4 text-xs font-black text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-50">Libérer</button></form>}
        </article>)}</div>}
      </div>
    </section>}

    {section === "settings" && isOwner && <section className="max-w-3xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div><h2 className="text-lg font-black">Paramètres de stock</h2><p className="mt-1 text-sm text-[var(--muted)]">Ces règles s’appliquent à tous les magasins de cet établissement Commerce.</p></div>
      <form onSubmit={saveSettings} className="mt-5 space-y-5">
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--line)] p-4 text-sm font-bold text-[var(--primary)]"><input type="checkbox" checked={settingsForm.allowNegativeStock} onChange={(event) => setSettingsForm((current) => ({ ...current, allowNegativeStock: event.target.checked }))} className="h-5 w-5 accent-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2" />Autoriser un solde physique négatif, uniquement si l’activité le nécessite.</label>
        <label className={`${labelClass} max-w-xs`}>Durée d’une réservation, en heures<input required type="number" min="1" max="168" step="1" className={inputClass} value={settingsForm.reservationDurationHours} onChange={(event) => setSettingsForm((current) => ({ ...current, reservationDurationHours: event.target.value }))} /><span className="mt-1 block text-xs font-medium">Valeur autorisée : de 1 à 168 heures. Le défaut est 24 heures.</span></label>
        <button disabled={saving || !canWrite} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer les paramètres"}</button>
      </form>
    </section>}
  </div>;
}
