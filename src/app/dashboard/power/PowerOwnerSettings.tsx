// Design Read: Power owner controls, compact settings panel, explicit security copy, no plaintext credential echo.
"use client";

import { FormEvent, useEffect, useState } from "react";

type PowerSettings = { zonesTablesEnabled: boolean; paymentMode: "SIMPLE" | "PERSONNEL"; personalMtnConfigured: boolean; personalMtnUpdatedAt: string | null; personalMtnLast4: { apiUser: string | null; apiKey: string | null; collection: string | null; disbursement: string | null } | null };
const emptyCredentials = { apiUser: "", apiKey: "", collectionSubscriptionKey: "", disbursementSubscriptionKey: "" };

export function PowerOwnerSettings({ tenantId, isOwner }: { tenantId: string; isOwner: boolean }) {
  const [settings, setSettings] = useState<PowerSettings | null>(null);
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!isOwner) return;
    const response = await fetch(`/api/power/settings?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
    const result = await response.json() as { settings?: PowerSettings; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Réglages indisponibles.");
    setSettings(result.settings ?? null);
  }
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Réglages indisponibles.")); }, [tenantId, isOwner]);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/power/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, zonesTablesEnabled: settings?.zonesTablesEnabled, paymentMode: settings?.paymentMode, credentials: settings?.paymentMode === "PERSONNEL" && Object.values(credentials).some(Boolean) ? credentials : undefined }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer les réglages.");
      setCredentials(emptyCredentials); setMessage(result.message ?? "Réglages enregistrés."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer les réglages."); } finally { setBusy(false); }
  }

  if (!isOwner || !settings) return null;
  return <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Réglages propriétaire</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Options spéciales Power</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Ces paramètres s’appliquent uniquement à BAR SANTE PLUS et ne modifient pas les plans standards.</p></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black uppercase text-[var(--primary)]">Propriétaire uniquement</span></div>{(error || message) && <p role={error ? "alert" : "status"} className={`mt-5 rounded-lg px-4 py-3 text-sm font-bold ${error ? "bg-red-50 text-red-700" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{error || message}</p>}<form onSubmit={save} className="mt-6 space-y-6"><div className="grid gap-4 lg:grid-cols-2"><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] p-4"><input type="checkbox" checked={settings.zonesTablesEnabled} onChange={(event) => setSettings({ ...settings, zonesTablesEnabled: event.target.checked })} className="mt-1 h-5 w-5 accent-[var(--primary)]" /><span><span className="block font-black text-[var(--primary)]">Activer zones et tables</span><span className="mt-1 block text-sm leading-5 text-[var(--muted)]">Activé : la zone et la table deviennent obligatoires pour une commande.</span></span></label><div className="rounded-xl border border-[var(--line)] p-4"><p className="font-black text-[var(--primary)]">Paiement de l’établissement</p><div className="mt-3 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm font-bold text-[var(--primary)]"><input type="radio" name="paymentMode" value="SIMPLE" checked={settings.paymentMode === "SIMPLE"} onChange={() => setSettings({ ...settings, paymentMode: "SIMPLE" })} />Simple</label><label className="flex items-center gap-2 text-sm font-bold text-[var(--primary)]"><input type="radio" name="paymentMode" value="PERSONNEL" checked={settings.paymentMode === "PERSONNEL"} onChange={() => setSettings({ ...settings, paymentMode: "PERSONNEL" })} />Personnel</label></div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Simple utilise le compte DebitManager. Personnel utilise les credentials MTN MoMo propres à l’établissement.</p></div></div>{settings.paymentMode === "PERSONNEL" && <div className="rounded-xl border border-[var(--secondary)]/30 bg-[var(--background)] p-5"><h3 className="font-black text-[var(--primary)]">Configuration MTN MoMo Personnel</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Saisissez les paramètres fournis par MTN MoMo. Ils seront chiffrés côté serveur, puis les champs seront vidés après sauvegarde.</p>{settings.personalMtnConfigured && <p className="mt-3 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--primary)]">Configuration enregistrée{settings.personalMtnUpdatedAt ? ` le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(settings.personalMtnUpdatedAt))}` : ""}. Les identifiants sont masqués.</p>}<div className="mt-4 grid gap-4 md:grid-cols-2">{([ ["apiUser", "API User"], ["apiKey", "API Key"], ["collectionSubscriptionKey", "Clé souscription Collection"], ["disbursementSubscriptionKey", "Clé souscription Disbursement"] ] as const).map(([field, label]) => <label key={field} className="block text-sm font-bold text-[var(--primary)]">{label}<input type="password" autoComplete="new-password" value={credentials[field]} onChange={(event) => setCredentials({ ...credentials, [field]: event.target.value })} placeholder={settings.personalMtnConfigured ? "Laisser vide pour conserver" : "Saisir la valeur"} className="mt-2 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3" /></label>)}</div></div>}<button disabled={busy} className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Enregistrement sécurisé…" : "Enregistrer les réglages"}</button></form></section>;
}
