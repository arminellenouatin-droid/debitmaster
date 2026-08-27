// DebitManager Power Repas: file cuisine et affectations multi-cuisiniers, séparées de la file Boissons.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "CHEF_CUISINE" | "CUISINIER";
type MealOrder = { id: string; order_number: string; table_label: string | null; server_name: string | null; status: string; created_at: string; order_items?: { id: string; product_name: string; quantity: number; fulfillment_unit: string | null }[] };
type Cook = { id: string; first_name: string; last_name: string };
type Assignment = { id: string; order_id: string; order_item_id: string; cook_employee_id: string; quantity: number; status: string; order_items?: { product_name: string; fulfillment_unit: string | null } | { product_name: string; fulfillment_unit: string | null }[] | null; employees?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null };

const statusLabel: Record<string, string> = { PENDING: "En attente", IN_PREPARATION: "En préparation", READY: "Prêt", HANDED_OFF: "Remis au service" };
const nextStatus: Record<string, string> = { ASSIGNED: "IN_PREPARATION", IN_PREPARATION: "READY", READY: "HANDED_OFF" };
const nextLabel: Record<string, string> = { ASSIGNED: "Commencer", IN_PREPARATION: "Marquer prêt", READY: "Remettre au service" };
const first = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value;

export function MealKitchenClient({ tenantId, role, employeeId }: { tenantId: string; role: Role; employeeId: string | null }) {
  const [orders, setOrders] = useState<MealOrder[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [cooks, setCooks] = useState<Cook[]>([]);
  const [selectedCook, setSelectedCook] = useState<Record<string, string>>({});
  const [selectedQuantity, setSelectedQuantity] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [ordersResponse, assignmentsResponse] = await Promise.all([
        fetch(`/api/orders?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
        fetch(`/api/kitchen/assignments?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      ]);
      const [ordersResult, assignmentsResult] = await Promise.all([ordersResponse.json(), assignmentsResponse.json()]);
      if (!ordersResponse.ok) throw new Error(ordersResult.error ?? "Impossible de charger les commandes repas.");
      if (!assignmentsResponse.ok) throw new Error(assignmentsResult.error ?? "Impossible de charger les affectations cuisine.");
      setOrders((ordersResult.orders ?? []).map((order: MealOrder) => ({ ...order, order_items: (order.order_items ?? []).filter((item) => item.fulfillment_unit === "MEAL") })).filter((order: MealOrder) => order.order_items?.length));
      setAssignments(assignmentsResult.assignments ?? []);
      setCooks(assignmentsResult.cooks ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger la cuisine."); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  const remaining = useMemo(() => {
    const totals = new Map<string, number>();
    for (const assignment of assignments) if (assignment.status !== "CANCELLED") totals.set(assignment.order_item_id, (totals.get(assignment.order_item_id) ?? 0) + assignment.quantity);
    return totals;
  }, [assignments]);

  async function assign(order: MealOrder, item: NonNullable<MealOrder["order_items"]>[number]) {
    const cookEmployeeId = selectedCook[item.id] ?? "";
    const quantity = Number(selectedQuantity[item.id] ?? item.quantity - (remaining.get(item.id) ?? 0));
    if (!cookEmployeeId || !Number.isInteger(quantity) || quantity < 1) return setError("Sélectionnez un Cuisinier et une quantité valide.");
    setBusy(`assign-${item.id}`); setError(""); setNotice("");
    try {
      const response = await fetch("/api/kitchen/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, orderId: order.id, orderItemId: item.id, cookEmployeeId, quantity }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’affecter la préparation.");
      setNotice(`${quantity} × ${item.product_name} affecté(e) au Cuisinier.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’affecter la préparation."); }
    finally { setBusy(""); }
  }

  async function advance(assignment: Assignment) {
    const status = nextStatus[assignment.status];
    if (!status) return;
    setBusy(assignment.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/kitchen/assignments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, assignmentId: assignment.id, status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de mettre à jour la préparation.");
      setAssignments((current) => current.map((item) => item.id === assignment.id ? result.assignment : item));
      setNotice(`Préparation mise à jour : ${statusLabel[status] ?? status}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de mettre à jour la préparation."); }
    finally { setBusy(""); }
  }

  return <main className="space-y-7">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Power · Cuisine / Repas</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--primary)]">{role === "CHEF_CUISINE" ? "Pilotage des repas" : "Mes préparations"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Les boissons restent dans leur circuit séparé. Cette file concerne uniquement les lignes repas.</p></div><button type="button" onClick={() => void load()} className="h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-black text-white">Actualiser</button></header>
    {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-bold ${error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{error || notice}</p>}
    {loading ? <div className="rounded-2xl bg-[var(--surface)] p-12 text-center text-sm font-bold text-[var(--muted)]">Chargement du pôle repas…</div> : role === "CUISINIER" ? <section className="space-y-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Affectations reçues</p><h2 className="mt-2 text-2xl font-black text-[var(--primary)]">Mes préparations</h2></div>{assignments.length ? assignments.map((assignment) => { const item = first(assignment.order_items); return <article key={assignment.id} className="rounded-2xl bg-[var(--surface)] p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="font-black text-[var(--primary)]">{item?.product_name ?? "Repas"} · {assignment.quantity} unité(s)</p><p className="mt-1 text-xs font-bold text-[var(--muted)]">Commande {assignment.order_id.slice(0, 8)} · {statusLabel[assignment.status] ?? assignment.status}</p></div>{nextStatus[assignment.status] && <button type="button" disabled={busy === assignment.id} onClick={() => void advance(assignment)} className="rounded-lg bg-[var(--primary)] px-4 py-3 text-xs font-black text-white">{busy === assignment.id ? "Mise à jour…" : nextLabel[assignment.status]}</button>}</div></article>; }) : <p className="rounded-2xl bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">Aucune préparation ne vous est attribuée.</p>}</section> : <section className="space-y-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Commandes repas reçues</p><h2 className="mt-2 text-2xl font-black text-[var(--primary)]">Répartir les préparations</h2></div>{orders.length ? orders.map((order) => <article key={order.id} className="rounded-2xl bg-[var(--surface)] p-5"><div className="flex flex-col justify-between gap-2 border-b border-[var(--line)] pb-4 sm:flex-row"><div><p className="font-black text-[var(--primary)]">{order.order_number} · {order.table_label ?? "Sans table"}</p><p className="mt-1 text-xs text-[var(--muted)]">{order.server_name ?? "Serveuse"} · {new Date(order.created_at).toLocaleString("fr-FR")}</p></div><span className="text-xs font-black text-[var(--secondary)]">Commande {statusLabel[order.status] ?? order.status}</span></div><div className="mt-4 space-y-4">{order.order_items?.map((item) => { const left = item.quantity - (remaining.get(item.id) ?? 0); return <div key={item.id} className="rounded-xl border border-[var(--line)] p-4"><div className="flex justify-between gap-3 text-sm"><span className="font-black text-[var(--primary)]">{item.product_name}</span><span className="font-black">{left} restant(s) / {item.quantity}</span></div>{left > 0 && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={selectedCook[item.id] ?? ""} onChange={(event) => setSelectedCook((current) => ({ ...current, [item.id]: event.target.value }))} className="h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm"><option value="">Choisir un Cuisinier</option>{cooks.map((cook) => <option key={cook.id} value={cook.id}>{cook.first_name} {cook.last_name}</option>)}</select><input type="number" min="1" max={left} value={selectedQuantity[item.id] ?? left} onChange={(event) => setSelectedQuantity((current) => ({ ...current, [item.id]: event.target.value }))} className="h-10 w-28 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm"/><button type="button" disabled={busy === `assign-${item.id}`} onClick={() => void assign(order, item)} className="h-10 rounded-lg bg-[var(--primary)] px-4 text-xs font-black text-white">{busy === `assign-${item.id}` ? "Affectation…" : "Affecter"}</button></div>}<div className="mt-3 space-y-2">{assignments.filter((assignment) => assignment.order_item_id === item.id).map((assignment) => { const cook = first(assignment.employees); return <p key={assignment.id} className="text-xs font-bold text-[var(--muted)]">{assignment.quantity} × {cook ? `${cook.first_name} ${cook.last_name}` : "Cuisinier"} · {statusLabel[assignment.status] ?? assignment.status}</p>; })}</div></div>; })}</div></article>) : <p className="rounded-2xl bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">Aucune commande repas reçue.</p>}</section>}
  </main>;
}
