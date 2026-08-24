/* Maquette plandesalle: plan de salle responsive, tables déduites des commandes tenant réelles et état vide honnête si aucun repère n’existe. */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Company = { id: string; name: string };
type Order = { id: string; table_label: string | null; status: string; total_amount: number; created_at: string };
const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;

export function TablesClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/companies").then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Impossible de charger vos établissements."); if (!active) return; const list = result.companies ?? []; setCompanies(list); if (list[0]) setTenantId(list[0].id); }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger les établissements.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!tenantId) return;
    let active = true; setLoading(true); setError("");
    fetch(`/api/orders?tenantId=${encodeURIComponent(tenantId)}`).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Impossible de charger le plan de salle."); if (active) setOrders(result.orders ?? []); }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger le plan de salle.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [tenantId]);

  const tables = Array.from(new Map(orders.filter((order) => order.table_label).map((order) => [order.table_label, order])).values());
  return <section><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Tables</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--primary)]">Plan de salle</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Retrouvez les repères de table déjà utilisés dans les commandes de votre établissement.</p></div><div className="flex gap-3">{companies.length > 1 && <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--primary)]">{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>}<Link href="/dashboard/orders" className="inline-flex h-11 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-black text-white">Nouvelle commande</Link></div></div>{error && <p role="alert" className="mt-6 rounded-lg bg-[#ffdad6] px-4 py-3 text-sm font-bold text-[var(--danger)]">{error}</p>}<div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Vue actuelle</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Disposition de l’établissement</h2></div><div className="flex gap-4 text-xs font-bold text-[var(--muted)]"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[var(--primary-container)]" /> Libre</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[var(--secondary-container)]" /> Active</span></div></div>{loading ? <p className="py-16 text-center text-sm font-bold text-[var(--muted)]">Chargement du plan…</p> : tables.length ? <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{tables.map((table) => <Link href={`/dashboard/orders?table=${encodeURIComponent(table.table_label ?? "")}`} key={table.id} className="min-h-36 rounded-xl border-2 border-[var(--secondary-container)] bg-[#fff8e8] p-5 transition hover:-translate-y-1"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--secondary-container)] text-sm font-black text-[var(--primary)]">⌂</span><span className="rounded-full bg-[var(--secondary-container)] px-2.5 py-1 text-[10px] font-black text-[var(--primary)]">Active</span></div><p className="mt-6 font-black text-[var(--primary)]">{table.table_label}</p><p className="mt-1 text-xs text-[var(--muted)]">{money(table.total_amount)}</p></Link>)}</div> : <div className="py-14 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xl text-[var(--primary)]">⌂</div><h3 className="mt-5 font-black text-[var(--primary)]">Votre plan de salle est vide</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Les repères apparaîtront ici dès qu’une commande sera associée à une table. Aucun espace n’est prérempli.</p><Link href="/dashboard/orders" className="mt-6 inline-flex rounded-lg border border-[var(--primary)] px-4 py-3 text-sm font-black text-[var(--primary)]">Ouvrir la prise de commande</Link></div>}</div></section>;
}
