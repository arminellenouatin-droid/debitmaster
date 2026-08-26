/* DebitManager Power owner orders: unified operational queue for beverages and meals, using tenant-scoped real data. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

type Item = { id: string; product_name: string; quantity: number; total_price: number; fulfillment_unit: string | null; preparation_status: string | null };
type Order = { id: string; order_number: string; server_user_id: string | null; server_name: string | null; table_label: string | null; status: string; total_amount: number; created_at: string; order_items?: Item[] };
type Server = { user_id: string; first_name: string; last_name: string };
type ResponseData = { orders: Order[]; serveuses: Server[]; metrics: { orderCount: number; revenue: number } };

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} XOF`;
const statusLabels: Record<string, string> = { PENDING: "Prise en charge", IN_PREPARATION: "En préparation", READY: "Prête à remettre", HANDED_OFF: "Remise au service", DELIVERED: "Livrée", PAID: "Payée" };
const statusTone: Record<string, string> = { PENDING: "bg-[#fff4d8] text-[#8a5d00]", IN_PREPARATION: "bg-[#e9f0ff] text-[#2457a6]", READY: "bg-[#dff3e7] text-[#17623c]", HANDED_OFF: "bg-[#eee9ff] text-[#5d3ea8]", DELIVERED: "bg-[#e6f7f5] text-[#176d64]", PAID: "bg-[#e2f4e8] text-[#17623c]" };

function orderKinds(order: Order) {
  const items = order.order_items ?? [];
  const meals = items.filter((item) => String(item.fulfillment_unit).toUpperCase() === "MEAL").reduce((sum, item) => sum + item.quantity, 0);
  const beverages = items.filter((item) => String(item.fulfillment_unit).toUpperCase() !== "MEAL").reduce((sum, item) => sum + item.quantity, 0);
  return { meals, beverages };
}

export function OwnerOrdersClient({ companyName }: { companyName: string }) {
  const [range, setRange] = useState("today");
  const [server, setServer] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/dashboard/gerant-overview?range=${range}`, { cache: "no-store" });
    if (!response.ok) { setError("Impossible de charger la file des commandes."); return; }
    setData(await response.json()); setError("");
  }, [range]);
  useEffect(() => { void refresh(); }, [refresh]);
  useLiveRefresh(refresh);

  const orders = useMemo(() => (data?.orders ?? []).filter((order) => {
    const needle = search.trim().toLowerCase();
    return (!server || order.server_user_id === server) && (!status || order.status === status) && (!needle || `${order.order_number} ${order.server_name ?? ""} ${order.table_label ?? ""}`.toLowerCase().includes(needle));
  }), [data, search, server, status]);
  const summary = useMemo(() => orders.reduce((result, order) => { const kinds = orderKinds(order); result.meals += kinds.meals > 0 ? 1 : 0; result.beverages += kinds.beverages > 0 ? 1 : 0; result.amount += Number(order.total_amount ?? 0); result[kindKey(order.status)] += 1; return result; }, { meals: 0, beverages: 0, amount: 0, pending: 0, preparation: 0, ready: 0, handed: 0, delivered: 0, paid: 0 } as Record<string, number>), [orders]);

  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Propriétaire · {companyName}</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--primary)]">Commandes</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Une file unique pour suivre les boissons et les repas, depuis la prise en charge jusqu’à la remise au service.</p></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-black text-[var(--primary)]">Actualisation en direct</span></div>
    {error && <div role="alert" className="rounded-xl border border-[#f0c8c8] bg-[#fff2f2] px-4 py-3 text-sm font-bold text-[#8c2525]">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Commandes", orders.length.toString()], ["Repas", summary.meals.toString()], ["Boissons", summary.beverages.toString()], ["En préparation", summary.preparation.toString()], ["Montant total", money(summary.amount)]].map(([label, value]) => <article key={label} className="rounded-2xl bg-[var(--surface)] p-5 shadow-[0_10px_35px_rgba(45,38,29,0.06)]"><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p><p className="mt-4 text-2xl font-black text-[var(--primary)]">{value}</p></article>)}</div>
    <section className="rounded-2xl bg-[var(--surface)] p-6 shadow-[0_10px_35px_rgba(45,38,29,0.06)]"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">File opérationnelle</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Toutes les commandes</h2></div><div className="flex flex-wrap gap-2"><select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--primary)]"><option value="today">Aujourd’hui</option><option value="7d">7 derniers jours</option><option value="30d">30 derniers jours</option><option value="90d">90 derniers jours</option></select><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--primary)]"><option value="">Tous les états</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={server} onChange={(event) => setServer(event.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--primary)]"><option value="">Toutes les personnes</option>{(data?.serveuses ?? []).map((item) => <option key={item.user_id} value={item.user_id}>{item.first_name} {item.last_name}</option>)}</select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="N° commande, serveur, table" className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" /></div></div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">{orders.map((order) => { const kinds = orderKinds(order); return <article key={order.id} className="rounded-xl border border-[var(--line)] p-4 transition hover:border-[var(--primary)]"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-black text-[var(--primary)]">{order.order_number} <span className="font-medium text-[var(--muted)]">· {order.table_label || "Comptoir"}</span></p><p className="mt-1 text-xs text-[var(--muted)]">{order.server_name || "Personne non renseignée"} · {new Date(order.created_at).toLocaleString("fr-FR")}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${statusTone[order.status] ?? "bg-[var(--surface-muted)] text-[var(--primary)]"}`}>{statusLabels[order.status] ?? order.status}</span></div><div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5">Repas : {kinds.meals}</span><span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5">Boissons : {kinds.beverages}</span><span className="ml-auto text-base font-black text-[var(--primary)]">{money(order.total_amount)}</span></div></article>; })}</div>{!orders.length && <p className="py-10 text-center text-sm text-[var(--muted)]">Aucune commande ne correspond à ces filtres.</p>}</section>
  </div>;
}

function kindKey(status: string) { return ({ PENDING: "pending", IN_PREPARATION: "preparation", READY: "ready", HANDED_OFF: "handed", DELIVERED: "delivered", PAID: "paid" } as Record<string, string>)[status] ?? "pending"; }
