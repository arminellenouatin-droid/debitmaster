"use client";
/* Direction DebitManager serveur: cockpit opérationnel compact, données personnelles uniquement, accent ambre sur fond ivoire. */
import { useEffect, useMemo, useState } from "react";

type Order = { id: string; order_number: string; table_label: string | null; status: string; total_amount: number; currency: string; created_at: string; payments?: { id: string; status: string; payment_method: string; amount: number }[] };
type DashboardData = { employee: { id: string; first_name: string; last_name: string; position: string; service_start_time: string | null; service_end_time: string | null; rest_day: number | null } | null; assignments: { id: string; dining_tables: { id: string; label: string; zone: string | null; capacity: number; status: string } | null }[]; orders: Order[]; metrics: { sales: number; paidSales: number; orderCount: number; commissionTotal: number }; commissions: { id: string; commission_amount: number; status: string; created_at: string }[] };
type Product = { id: string; name: string; price: number; category_id?: string | null };
type Customer = { id: string; full_name: string; phone: string | null; customer_type: string };

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} XOF`;
const statusLabel: Record<string, string> = { PENDING: "En attente", IN_PREPARATION: "En préparation", READY: "Prête à livrer", HANDED_OFF: "Remise au serveur", DELIVERED: "Livrée" };
const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function ServeurClient({ tenantId, firstName, companyName, initialTab = "dashboard" }: { tenantId: string; firstName: string; companyName: string; initialTab?: "dashboard" | "orders" | "sales" | "profile" }) {
  const [tab, setTab] = useState<"dashboard" | "orders" | "sales" | "profile">(initialTab);
  const [data, setData] = useState<DashboardData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [tableLabel, setTableLabel] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const response = await fetch("/api/dashboard/staff-overview", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  };
  const loadOrderData = async () => {
    const [productsResponse, customersResponse] = await Promise.all([fetch(`/api/products?tenantId=${tenantId}`), fetch(`/api/customers?tenantId=${tenantId}`)]);
    if (productsResponse.ok) setProducts((await productsResponse.json()).products ?? []);
    if (customersResponse.ok) setCustomers((await customersResponse.json()).customers ?? []);
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (tab === "orders") void loadOrderData(); }, [tab]);

  const assignedTables = useMemo(() => data?.assignments.map((assignment) => assignment.dining_tables).filter(Boolean) ?? [], [data]);
  const placeOrder = async () => {
    const product = products.find((item) => item.id === selectedProduct);
    if (!product || quantity < 1) return setNotice("Sélectionnez un article et une quantité valide.");
    setBusy(true); setNotice("");
    const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, tableLabel: tableLabel || null, customerId: customerId || null, lines: [{ productId: product.id, quantity }] }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Impossible de lancer la commande.");
    setNotice(`Commande ${result.order.order_number} envoyée en cuisine.`); setSelectedProduct(""); setQuantity(1); setTab("sales"); await refresh();
  };
  const createCustomer = async () => {
    if (newCustomer.trim().length < 2) return;
    const response = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, fullName: newCustomer, customerType: "NAMED" }) });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error ?? "Impossible de créer le client.");
    setCustomers((current) => [result.customer, ...current]); setCustomerId(result.customer.id); setNewCustomer(""); setNotice("Client enregistré.");
  };
  const pay = async (order: Order, method: "cash" | "moneroo") => {
    setBusy(true); setNotice("");
    const response = await fetch(`/api/payments/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, orderId: order.id }) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Impossible de préparer le règlement.");
    if (method === "moneroo" && result.checkoutUrl) window.location.href = result.checkoutUrl;
    else { setNotice("Encaissement cash enregistré."); await refresh(); }
  };

  if (!data) return <div className="rounded-2xl bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">Chargement de votre espace de service…</div>;
  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Espace service · {companyName}</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--primary)]">Bonjour, {firstName}.</h1><p className="mt-2 text-sm text-[var(--muted)]">Votre tournée, vos commandes, vos encaissements.</p></div><span className="w-fit rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-black text-[var(--primary)]">Serveur / serveuse</span></div>
    <div className="flex gap-2 overflow-x-auto border-b border-[var(--line)] pb-2">{([["dashboard", "Dashboard"], ["orders", "Commandes"], ["sales", "Ventes"], ["profile", "Profil"]] as const).map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-black transition ${tab === value ? "bg-[var(--primary)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-muted)]"}`}>{label}</button>)}</div>
    {notice && <div className="rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--primary)]">{notice}</div>}
    {tab === "dashboard" && <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Ventes personnelles", money(data.metrics.sales)], ["Commandes prises", data.metrics.orderCount.toString()], ["Ventes réglées", money(data.metrics.paidSales)], ["Commissions", money(data.metrics.commissionTotal)]].map(([label, value]) => <article key={label} className="rounded-2xl bg-[var(--surface)] p-5 shadow-[0_10px_35px_rgba(45,38,29,0.06)]"><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p><p className="mt-4 text-2xl font-black text-[var(--primary)]">{value}</p></article>)}</div><div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><section className="rounded-2xl bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Ma zone et mes tables</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">{assignedTables.length} table{assignedTables.length > 1 ? "s" : ""} attribuée{assignedTables.length > 1 ? "s" : ""}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{assignedTables.map((table) => <div key={table!.id} className="rounded-xl border border-[var(--line)] p-4"><p className="font-black text-[var(--primary)]">{table!.label}</p><p className="mt-1 text-xs text-[var(--muted)]">{table!.zone || "Zone non renseignée"} · {table!.capacity} places</p></div>)}{!assignedTables.length && <p className="text-sm text-[var(--muted)]">Aucune table attribuée pour le moment.</p>}</div></section><section className="rounded-2xl bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Organisation</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Votre service</h2><div className="mt-5 space-y-3 text-sm"><p className="flex justify-between"><span className="text-[var(--muted)]">Horaires</span><b>{data.employee?.service_start_time || "—"} → {data.employee?.service_end_time || "—"}</b></p><p className="flex justify-between"><span className="text-[var(--muted)]">Jour de repos</span><b>{data.employee ? (data.employee.rest_day === null ? "—" : days[data.employee.rest_day]) : "—"}</b></p><p className="flex justify-between"><span className="text-[var(--muted)]">Commissions reçues</span><b>{data.commissions.length}</b></p></div></section></div></div>}
    {tab === "orders" && <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><div className="rounded-2xl bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Nouvelle commande</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Prendre la commande</h2><label className="mt-5 block text-sm font-bold">Table attribuée<select value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-3"><option value="">Comptoir / à préciser</option>{assignedTables.map((table) => <option key={table!.id} value={table!.label}>{table!.label} · {table!.zone}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Client<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-3"><option value="">Client comptoir</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label><div className="mt-3 flex gap-2"><input value={newCustomer} onChange={(event) => setNewCustomer(event.target.value)} placeholder="Nouveau client nommé" className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"/><button onClick={() => void createCustomer()} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-black">Créer</button></div><label className="mt-4 block text-sm font-bold">Article<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-3"><option value="">Choisir un article</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.price)}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Quantité<input type="number" min="1" max="999" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-2 w-24 rounded-lg border border-[var(--line)] px-3 py-3"/></label><button disabled={busy} onClick={() => void placeOrder()} className="mt-6 w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Enregistrement…" : "Envoyer en cuisine"}</button></div><div className="rounded-2xl bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Disponibilité</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Articles de l’établissement</h2><div className="mt-5 divide-y divide-[var(--line)]">{products.slice(0, 12).map((product) => <div key={product.id} className="flex items-center justify-between py-3 text-sm"><span className="font-bold">{product.name}</span><span className="font-black text-[var(--secondary)]">{money(product.price)}</span></div>)}{!products.length && <p className="py-4 text-sm text-[var(--muted)]">Aucun article disponible.</p>}</div></div></section>}
    {tab === "sales" && <section className="rounded-2xl bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Suivi personnel</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Mes commandes</h2><div className="mt-5 space-y-3">{data.orders.map((order) => <div key={order.id} className="rounded-xl border border-[var(--line)] p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="font-black text-[var(--primary)]">{order.order_number} · {order.table_label || "Comptoir"}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(order.created_at).toLocaleString("fr-FR")} · {statusLabel[order.status] || order.status}</p></div><p className="font-black text-[var(--primary)]">{money(order.total_amount)}</p></div>{order.status === "HANDED_OFF" || order.status === "DELIVERED" ? <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void pay(order, "cash")} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-black text-white">Encaisser cash</button><button disabled={busy} onClick={() => void pay(order, "moneroo")} className="rounded-lg border border-[var(--primary)] px-3 py-2 text-xs font-black text-[var(--primary)]">Mobile Money · Moneroo</button></div> : <p className="mt-3 text-xs font-bold text-[var(--muted)]">Le règlement sera disponible après remise par le gérant.</p>}</div>)}{!data.orders.length && <p className="py-8 text-sm text-[var(--muted)]">Aucune commande personnelle enregistrée.</p>}</div></section>}
    {tab === "profile" && <section className="max-w-2xl rounded-2xl bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Profil de service</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">{data.employee?.first_name} {data.employee?.last_name}</h2><div className="mt-6 space-y-4 text-sm"><p className="flex justify-between border-b border-[var(--line)] pb-3"><span className="text-[var(--muted)]">Poste</span><b>Serveur / serveuse</b></p><p className="flex justify-between border-b border-[var(--line)] pb-3"><span className="text-[var(--muted)]">Horaires</span><b>{data.employee?.service_start_time || "—"} → {data.employee?.service_end_time || "—"}</b></p><p className="flex justify-between border-b border-[var(--line)] pb-3"><span className="text-[var(--muted)]">Repos</span><b>{data.employee ? (data.employee.rest_day === null ? "Non défini" : days[data.employee.rest_day]) : "Non défini"}</b></p></div></section>}
  </div>;
}
