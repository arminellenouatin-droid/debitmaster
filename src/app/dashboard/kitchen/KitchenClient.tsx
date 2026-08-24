/* DebitManager / maquette fildattentecuisine: KDS dense et lisible, actions visibles seulement si le rôle peut faire avancer la commande. */
"use client";

import { useEffect, useMemo, useState } from "react";

type Company = { id: string; name: string };
type OrderItem = { id: string; product_name: string; quantity: number };
type Order = { id: string; order_number: string; table_label: string | null; status: string; created_at: string; order_items?: OrderItem[] };

type StatusKey = "PENDING" | "IN_PREPARATION" | "READY" | "HANDED_OFF";

const columns: { key: StatusKey; label: string; tone: string }[] = [
  { key: "PENDING", label: "À prendre en charge", tone: "border-[var(--line)]" },
  { key: "IN_PREPARATION", label: "En préparation", tone: "border-[var(--secondary-container)]" },
  { key: "READY", label: "Prêtes à remettre", tone: "border-[var(--primary-container)]" },
  { key: "HANDED_OFF", label: "Remises au service", tone: "border-[var(--accent)]" },
];

const normalizeStatus = (status: string) => status.toUpperCase().replaceAll("-", "_");
const nextStatus = (status: string) => (status === "PENDING" ? "IN_PREPARATION" : status === "IN_PREPARATION" ? "READY" : status === "READY" ? "HANDED_OFF" : "DELIVERED");
const nextLabel = (status: string) => (status === "PENDING" ? "Prendre en charge" : status === "IN_PREPARATION" ? "Marquer prête" : status === "READY" ? "Remettre au service" : "Confirmer la livraison");

export function KitchenClient({ canPrepare, canHandoff, canDeliver }: { canPrepare: boolean; canHandoff: boolean; canDeliver: boolean }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  async function load(id: string) {
    const response = await fetch(`/api/orders?tenantId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Impossible de charger la file cuisine.");
    setOrders(result.orders ?? []);
    setLastRefresh(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
  }

  useEffect(() => {
    let active = true;
    fetch("/api/companies")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger vos établissements.");
        const list = result.companies ?? [];
        if (!active) return;
        setCompanies(list);
        if (list[0]) setTenantId(list[0].id);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger vos établissements."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    setLoading(true);
    setError("");
    load(tenantId)
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger la file cuisine."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tenantId]);

  const grouped = useMemo(() => {
    const result: Record<StatusKey, Order[]> = { PENDING: [], IN_PREPARATION: [], READY: [], HANDED_OFF: [] };
    for (const order of orders) {
      const key = normalizeStatus(order.status) as StatusKey;
      if (result[key]) result[key].push(order);
    }
    return result;
  }, [orders]);

  async function changeStatus(order: Order) {
    const currentStatus = normalizeStatus(order.status);
    const status = nextStatus(currentStatus);
    const allowed = currentStatus === "READY" ? canHandoff : currentStatus === "HANDED_OFF" ? canDeliver : canPrepare;
    if (!allowed) {
      setError("Votre rôle ne permet pas de faire avancer cette commande.");
      return;
    }
    setError("");
    setMessage("");
    setPendingId(order.id);
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, orderId: order.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de modifier le statut.");
      setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: result.order.status } : item)));
      setMessage(`${order.order_number} est maintenant « ${status === "IN_PREPARATION" ? "en préparation" : status === "READY" ? "prête" : status === "HANDED_OFF" ? "remise au service" : "livrée"} ».`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de modifier le statut.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <section>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Cuisine & bar</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--primary)]">File d’attente</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Le gérant et la cuisine préparent, puis remettent la commande au service. Le serveur est le seul rôle qui confirme la livraison au client.</p>
        </div>
        <div className="flex items-center gap-3">
          {companies.length > 1 && (
            <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--primary)]">
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          )}
          <button onClick={() => tenantId && load(tenantId).catch((cause) => setError(cause instanceof Error ? cause.message : "Actualisation impossible."))} className="h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-black text-white">
            Actualiser
          </button>
        </div>
      </div>

      {(error || message) && <p role={error ? "alert" : "status"} className={`mt-6 rounded-lg px-4 py-3 text-sm font-bold ${error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{error || message}</p>}
      <div className="mt-6 flex items-center justify-between text-xs font-bold text-[var(--muted)]"><span>{orders.length} commande(s) chargée(s)</span><span>{lastRefresh ? `Dernière actualisation ${lastRefresh}` : "En attente"}</span></div>

      {loading ? (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-12 text-center text-sm font-bold text-[var(--muted)]">Chargement de la file…</div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          {columns.map((column) => (
            <section key={column.key} className={`min-h-80 rounded-xl border-2 ${column.tone} bg-[var(--surface)] p-4`}>
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-4"><h2 className="font-black text-[var(--primary)]">{column.label}</h2><span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--surface-muted)] px-2 text-xs font-black text-[var(--primary)]">{grouped[column.key].length}</span></div>
              <div className="mt-4 space-y-3">
                {grouped[column.key].length ? grouped[column.key].map((order) => {
                  const currentStatus = normalizeStatus(order.status);
                  const canChange = currentStatus === "READY" ? canHandoff : currentStatus === "HANDED_OFF" ? canDeliver : canPrepare;
                  return (
                    <article key={order.id} className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4">
                      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-[var(--primary)]">{order.order_number}</p><p className="mt-1 text-xs font-bold text-[var(--muted)]">{order.table_label ?? "Sans table"}</p></div><span className="text-xs font-black text-[var(--secondary)]">{new Date(order.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
                      <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">{order.order_items?.length ? order.order_items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="font-bold text-[var(--ink)]">{item.product_name}</span><span className="font-black text-[var(--primary)]">×{item.quantity}</span></div>) : <p className="text-xs text-[var(--muted)]">Détail non disponible.</p>}</div>
                      {canChange ? <button disabled={pendingId === order.id} onClick={() => changeStatus(order)} className="mt-4 h-10 w-full rounded-lg bg-[var(--primary)] text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45">{pendingId === order.id ? "Mise à jour…" : nextLabel(currentStatus)}</button> : <p className="mt-4 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-center text-xs font-bold text-[var(--muted)]">Action réservée à un rôle habilité</p>}
                    </article>
                  );
                }) : <div className="rounded-lg border border-dashed border-[var(--line)] p-6 text-center text-sm leading-6 text-[var(--muted)]">Aucune commande dans cette étape.</div>}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
