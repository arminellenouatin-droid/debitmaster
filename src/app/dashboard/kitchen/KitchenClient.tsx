/* DebitManager / maquette fildattentecuisine: KDS dense, tactile et lisible pour le personnel en cuisine. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { UtensilsCrossed, Clock, CheckCircle2, RotateCcw, Check, Sparkles, AlertCircle } from "@/components/Icons";

type Company = { id: string; name: string };
type OrderItem = { id: string; product_name: string; quantity: number };
type Order = {
  id: string;
  order_number: string;
  table_label: string | null;
  status: string;
  created_at: string;
  order_items?: OrderItem[];
};

type StatusKey = "PENDING" | "IN_PREPARATION" | "READY" | "HANDED_OFF";

const columns: { key: StatusKey; label: string; badgeColor: string }[] = [
  { key: "PENDING", label: "À préparer", badgeColor: "bg-amber-100 text-amber-900 border-amber-300" },
  { key: "IN_PREPARATION", label: "En cuisson / Au bar", badgeColor: "bg-blue-100 text-blue-900 border-blue-300" },
  { key: "READY", label: "Prêtes à servir", badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { key: "HANDED_OFF", label: "Remises au service", badgeColor: "bg-slate-100 text-slate-800 border-slate-300" },
];

const normalizeStatus = (status: string) => status.toUpperCase().replaceAll("-", "_");
const nextStatus = (status: string) =>
  status === "PENDING"
    ? "IN_PREPARATION"
    : status === "IN_PREPARATION"
    ? "READY"
    : status === "READY"
    ? "HANDED_OFF"
    : "DELIVERED";
const nextLabel = (status: string) =>
  status === "PENDING"
    ? "Prendre en charge →"
    : status === "IN_PREPARATION"
    ? "MARQUER PRÊT ✓"
    : status === "READY"
    ? "Remettre au service ✓"
    : "Confirmer la livraison";

export function KitchenClient({
  canPrepare,
  canHandoff,
  canDeliver,
}: {
  canPrepare: boolean;
  canHandoff: boolean;
  canDeliver: boolean;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");
  const [mobileFilter, setMobileFilter] = useState<StatusKey | "ALL">("ALL");

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
      setMessage(
        `${order.order_number} est maintenant « ${
          status === "IN_PREPARATION"
            ? "en préparation"
            : status === "READY"
            ? "prête"
            : status === "HANDED_OFF"
            ? "remise au service"
            : "livrée"
        } ».`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de modifier le statut.");
    } finally {
      setPendingId("");
    }
  }

  // Calculate elapsed minutes for visual alert
  const getElapsed = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    return mins;
  };

  const displayedColumns = mobileFilter === "ALL" ? columns : columns.filter((c) => c.key === mobileFilter);

  return (
    <section className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-[#0c1e18] p-5 text-white shadow-md sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-slate-950 shadow-md">
            <UtensilsCrossed className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">Écran Cuisine KDS & Bar</span>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">Bons de Préparation en Direct</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {companies.length > 1 && (
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-bold text-white"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => tenantId && load(tenantId).catch(() => setError("Actualisation impossible."))}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500 shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Alert notice */}
      {(error || message) && (
        <div
          role={error ? "alert" : "status"}
          className={`flex items-center justify-between rounded-xl px-4 py-3 text-xs font-bold shadow-sm ${
            error ? "bg-red-50 text-red-900 border border-red-200" : "bg-emerald-50 text-emerald-900 border border-emerald-200"
          }`}
        >
          <span>{error || message}</span>
          <button onClick={() => { setError(""); setMessage(""); }}>
            ✕
          </button>
        </div>
      )}

      {/* Mobile Column Quick Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200 lg:hidden">
        <button
          onClick={() => setMobileFilter("ALL")}
          className={`flex-1 min-w-[90px] rounded-lg py-2 text-center text-xs font-black transition ${
            mobileFilter === "ALL" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Tous ({orders.length})
        </button>
        {columns.map((c) => (
          <button
            key={c.key}
            onClick={() => setMobileFilter(c.key)}
            className={`flex-1 min-w-[110px] rounded-lg py-2 text-center text-xs font-black transition ${
              mobileFilter === c.key ? "bg-emerald-700 text-white shadow" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {c.label} ({grouped[c.key].length})
          </button>
        ))}
      </div>

      {/* KDS Grid Columns */}
      {loading ? (
        <div className="flex min-h-[350px] items-center justify-center rounded-2xl bg-white p-12 text-slate-500 shadow-sm">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
            <p className="mt-3 text-xs font-bold">Chargement des commandes en cuisine…</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {displayedColumns.map((col) => (
            <div key={col.key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-black uppercase text-slate-800">{col.label}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-black border ${col.badgeColor}`}>
                  {grouped[col.key].length}
                </span>
              </div>

              <div className="mt-3 space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                {grouped[col.key].map((order) => {
                  const currentStatus = normalizeStatus(order.status);
                  const canChange =
                    currentStatus === "READY" ? canHandoff : currentStatus === "HANDED_OFF" ? canDeliver : canPrepare;
                  const elapsed = getElapsed(order.created_at);
                  const isLate = elapsed >= 15;

                  return (
                    <article
                      key={order.id}
                      className={`flex flex-col justify-between rounded-xl border p-4 transition shadow-sm ${
                        isLate && currentStatus !== "HANDED_OFF"
                          ? "border-amber-400 bg-amber-50/40"
                          : "border-slate-200 bg-slate-50/70"
                      }`}
                    >
                      <div>
                        {/* Table badge and timer */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-black text-amber-400">
                              Table {order.table_label ?? "Libre"}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">{order.order_number}</span>
                          </div>
                          <span
                            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black ${
                              isLate ? "bg-red-100 text-red-800" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            {elapsed} min
                          </span>
                        </div>

                        {/* Dish items */}
                        <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-2.5">
                          {order.order_items?.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <span className="font-bold text-slate-900 leading-snug">{item.product_name}</span>
                              <span className="ml-2 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-900">
                                × {item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-4 pt-2 border-t border-slate-200/80">
                        {canChange ? (
                          <button
                            type="button"
                            disabled={pendingId === order.id}
                            onClick={() => changeStatus(order)}
                            className={`w-full rounded-xl py-3 text-xs font-black text-white shadow transition active:scale-95 ${
                              currentStatus === "IN_PREPARATION"
                                ? "bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-400/50 text-sm"
                                : "bg-slate-900 hover:bg-slate-800"
                            }`}
                          >
                            {pendingId === order.id ? "Mise à jour…" : nextLabel(currentStatus)}
                          </button>
                        ) : (
                          <span className="block text-center text-[10px] text-slate-400 py-1">
                            Action réservée
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}

                {!grouped[col.key].length && (
                  <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Aucune commande
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
