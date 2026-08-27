"use client";

// DebitManager Power services: catalogue de prestations filtré par activité, sans accès au catalogue repas ou boissons.
import { FormEvent, useEffect, useState } from "react";

type ActivityCode = "GYM" | "LAVAGE";
type Service = { id: string; name: string; description: string | null; price_xof: number; billing_unit: string; is_active: boolean };
const defaults: Record<ActivityCode, Array<{ name: string; price: number; unit: string; description: string }>> = {
  GYM: [
    { name: "Séance", price: 500, unit: "UNIT", description: "Séance d’entraînement" },
    { name: "Abonnement mensuel", price: 8200, unit: "MONTH", description: "Accès mensuel à la salle" },
    { name: "Tapis roulant", price: 500, unit: "5 MINUTES", description: "Cinq minutes d’exercice" },
    { name: "Vibromasseur", price: 300, unit: "3 MINUTES", description: "Trois minutes de massage" },
  ],
  LAVAGE: [],
};
const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} XOF`;

export function ServiceCatalogClient({ tenantId, activityCode }: { tenantId: string; activityCode: ActivityCode }) {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [price, setPrice] = useState(""); const [unit, setUnit] = useState("UNIT");
  const [editingId, setEditingId] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const label = activityCode === "GYM" ? "Liste des services Gym" : "Liste des prestations Lavage";

  async function load() {
    const response = await fetch(`/api/power/services?tenantId=${encodeURIComponent(tenantId)}&activityCode=${activityCode}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Impossible de charger les prestations.");
    setServices(result.services ?? []);
  }
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Impossible de charger les prestations.")); }, [tenantId, activityCode]);

  function reset() { setEditingId(null); setName(""); setDescription(""); setPrice(""); setUnit("UNIT"); }
  function edit(service: Service) { setEditingId(service.id); setName(service.name); setDescription(service.description ?? ""); setPrice(String(service.price_xof)); setUnit(service.billing_unit); setError(""); setNotice(""); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/power/services", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, activityCode, serviceId: editingId ?? undefined, name, description, priceXof: Number(price), billingUnit: unit, isActive: true }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer la prestation.");
      await load(); reset(); setNotice(editingId ? "Prestation modifiée." : "Prestation ajoutée.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer la prestation."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="service-catalog-title"><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Power · {activityCode}</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 id="service-catalog-title" className="text-4xl font-black tracking-[-0.05em] text-[var(--primary)]">{label}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Les prestations sont des services : aucune quantité ne sort du stock boissons ou du Magasin cuisine.</p></div><button type="button" onClick={() => void load()} className="h-10 rounded-lg border border-[var(--line)] px-4 text-xs font-black text-[var(--primary)]">Actualiser</button></div>{(error || notice) && <p role={error ? "alert" : "status"} className={`mt-6 rounded-xl px-4 py-3 text-sm font-bold ${error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{error || notice}</p>}<div className="mt-8 grid gap-6 xl:grid-cols-[350px_1fr]"><form onSubmit={submit} className="h-fit rounded-2xl bg-[var(--primary)] p-6 text-white"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">{editingId ? "Modifier" : "Ajouter"}</p><h2 className="mt-2 text-xl font-black">Prestation</h2></div>{editingId && <button type="button" onClick={reset} className="text-xs font-black text-white/70 underline">Annuler</button>}</div><label className="mt-5 block text-sm font-bold text-white/80">Nom<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-white placeholder:text-white/45" /></label><label className="mt-4 block text-sm font-bold text-white/80">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white placeholder:text-white/45" /></label><label className="mt-4 block text-sm font-bold text-white/80">Prix<input required min="0" type="number" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-white" /></label><label className="mt-4 block text-sm font-bold text-white/80">Unité de facturation<input required value={unit} onChange={(event) => setUnit(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-white" placeholder="UNIT, MONTH, 5 MINUTES…" /></label><button disabled={busy} className="mt-6 h-11 w-full rounded-lg bg-[var(--secondary-container)] text-sm font-black text-[var(--primary)] disabled:opacity-50">{busy ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter la prestation"}</button></form><div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="border-b border-[var(--line)] pb-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Tarifs actifs</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">{activityCode === "GYM" ? "Services disponibles" : "Prestations disponibles"}</h2></div>{services.length ? <div className="divide-y divide-[var(--line)]">{services.map((service) => <article key={service.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><p className="font-black text-[var(--primary)]">{service.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{service.description ?? "Sans description"} · {service.billing_unit}</p></div><div className="flex items-center gap-4"><strong className="text-lg text-[var(--primary)]">{money(service.price_xof)}</strong><button type="button" onClick={() => edit(service)} className="text-xs font-black text-[var(--secondary)]">Modifier</button></div></article>)}</div> : <div className="space-y-3 py-10 text-sm text-[var(--muted)]">{defaults[activityCode].map((item) => <div key={item.name} className="flex justify-between gap-3 border-b border-[var(--line)] pb-3"><span className="font-bold">{item.name}</span><span>{money(item.price)}</span></div>)}{!defaults[activityCode].length && <p>Aucune prestation enregistrée pour le moment.</p>}</div>}</div></div></section>;
}
