// DebitManager product UI: dashboard d’activation, actions tenant explicites et états loading/empty/error.
"use client";

import { FormEvent, useEffect, useState } from "react";

type Company = { id: string; name: string; activity_type: string; country: string; currency: string; status: string };

export function DashboardClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState("BAR_RESTAURANT");
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/companies").then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); setCompanies(result.companies ?? []); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Impossible de charger vos établissements.")).finally(() => setPending(false)); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    try { const response = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, activityType }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setCompanies((current) => [result.company, ...current]); setName(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Création impossible."); } finally { setSaving(false); }
  }

  return <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr]"><section><div className="flex items-end justify-between border-b border-[var(--line)] pb-5"><div><p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Vos établissements</p><h2 className="mt-2 font-serif text-4xl">Le centre de vos opérations.</h2></div><span className="font-sans text-sm text-[var(--muted)]">{companies.length} espace{companies.length > 1 ? "s" : ""}</span></div>{error && <p role="alert" className="mt-5 rounded-xl bg-[var(--accent-soft)] px-4 py-3 font-sans text-sm text-[var(--accent)]">{error}</p>}{pending ? <p className="mt-8 font-sans text-sm text-[var(--muted)]">Chargement de votre espace…</p> : companies.length === 0 ? <div className="mt-8 border border-dashed border-[var(--line)] px-6 py-10"><p className="font-serif text-2xl">Aucun établissement configuré.</p><p className="mt-2 max-w-md font-sans text-sm leading-6 text-[var(--muted)]">Créez votre premier espace pour commencer à organiser vos produits, vos commandes et votre équipe.</p></div> : <div className="mt-8 space-y-3">{companies.map((company) => <article key={company.id} className="flex items-center justify-between border-b border-[var(--line)] py-5"><div><h3 className="font-sans font-bold">{company.name}</h3><p className="mt-1 font-sans text-sm text-[var(--muted)]">{company.activity_type.replaceAll("_", " ")} · {company.currency} · {company.country}</p></div><span className="rounded-full bg-[color:var(--success)]/10 px-3 py-1.5 font-sans text-xs font-bold text-[var(--success)]">{company.status}</span></article>)}</div>}</section><section className="bg-[var(--surface)] p-7 shadow-[0_20px_50px_-38px_var(--ink)]"><p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Étape 01</p><h2 className="mt-3 font-serif text-3xl">Créer un établissement</h2><p className="mt-3 font-sans text-sm leading-6 text-[var(--muted)]">Ces informations définissent le premier tenant auquel vos opérations seront rattachées.</p><form onSubmit={submit} className="mt-7 space-y-5"><label className="block font-sans text-sm font-semibold">Nom de l’établissement<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-4" /></label><label className="block font-sans text-sm font-semibold">Type<select value={activityType} onChange={(event) => setActivityType(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-4"><option value="BUVETTE">Buvette</option><option value="BAR_RESTAURANT">Bar restaurant</option><option value="NIGHTCLUB_LOUNGE">Nightclub / lounge</option></select></label><button disabled={saving} className="w-full rounded-full bg-[var(--accent)] px-5 py-3.5 font-sans text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{saving ? "Création…" : "Créer l’établissement"}</button></form></section></div>;
}
