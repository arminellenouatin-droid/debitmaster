// DebitManager settings: calm operational surfaces, with subscription controls visible only to the establishment owner.
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { SubscriptionPlans } from "./SubscriptionPlans";

export function SettingsClient({ firstName, email, phone, mustChangePassword, tenantId, isOwner }: { firstName: string; email: string; phone: string; mustChangePassword: boolean; tenantId: string; isOwner: boolean }) {
  const [compact, setCompact] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(mustChangePassword);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage(""); setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmation }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de modifier le mot de passe.");
      setPassword(""); setConfirmation(""); setShowPasswordForm(false); setMessage("Votre mot de passe temporaire a été remplacé. Votre accès est maintenant sécurisé.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de modifier le mot de passe.");
    } finally { setPending(false); }
  }

  return <section>
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Settings</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--primary)]">Paramètres de votre espace</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Retrouvez les informations de votre profil et les points de configuration importants de DebitManager.</p></div>
    {mustChangePassword && <div className="mt-6 rounded-xl border-2 border-[var(--secondary)] bg-[var(--secondary-container)] p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--primary)]">Action requise</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Remplacez votre mot de passe temporaire</h2><p className="mt-2 text-sm leading-6 text-[var(--primary)]">Pour protéger votre compte équipe, ce mot de passe doit être changé avant toute utilisation durable de l’espace.</p></div>}
    {(error || message) && <p role={error ? "alert" : "status"} className={`mt-6 rounded-lg px-4 py-3 text-sm font-bold ${error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{error || message}</p>}
    {isOwner && tenantId && <div className="mt-8"><SubscriptionPlans tenantId={tenantId} /></div>}
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Profil</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Vos informations</h2><div className="mt-6 space-y-4"><div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-lg font-black text-[var(--primary)]">{firstName.slice(0, 1).toUpperCase()}</span><div><p className="font-black text-[var(--primary)]">{firstName || "Utilisateur"}</p><p className="mt-1 text-sm text-[var(--muted)]">{email || phone || "Identifiant non disponible"}</p></div></div><p className="rounded-lg bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--muted)]">Les données d’identité sont gérées par votre session Supabase. Aucun mot de passe ou secret n’est affiché dans cette page.</p></div></section>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Sécurité</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Accès et session</h2><div className="mt-6 space-y-3"><div className="flex items-center justify-between rounded-lg border border-[var(--line)] p-4"><div><p className="font-black text-[var(--primary)]">Session Supabase SSR</p><p className="mt-1 text-xs text-[var(--muted)]">Cookie de session renouvelé côté serveur.</p></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black uppercase text-[var(--primary)]">Active</span></div><div className="flex items-center justify-between rounded-lg border border-[var(--line)] p-4"><div><p className="font-black text-[var(--primary)]">Isolation tenant</p><p className="mt-1 text-xs text-[var(--muted)]">Les API vérifient l’établissement avant chaque opération.</p></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black uppercase text-[var(--primary)]">Active</span></div></div></section>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-2"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Mot de passe</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Modifier votre accès</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Utilisez au moins 8 caractères et ne partagez jamais ce mot de passe.</p></div>{!showPasswordForm && <button type="button" onClick={() => setShowPasswordForm(true)} className="rounded-lg border border-[var(--line)] px-4 py-3 text-sm font-black text-[var(--primary)]">Modifier</button>}</div>{showPasswordForm && <form onSubmit={changePassword} className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[var(--primary)]">Nouveau mot de passe<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4" /></label><label className="text-sm font-bold text-[var(--primary)]">Confirmer le mot de passe<input required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4" /></label><button disabled={pending} className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white sm:col-span-2 sm:justify-self-start disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}</button></form>}</section>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Préférences</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Votre confort de travail</h2><label className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] p-4"><span><span className="block font-black text-[var(--primary)]">Vue compacte</span><span className="mt-1 block text-xs text-[var(--muted)]">Réduit l’espace entre les éléments des listes.</span></span><input type="checkbox" checked={compact} onChange={(event) => { setCompact(event.target.checked); setMessage("Préférence appliquée à cette session."); }} className="h-5 w-5 accent-[var(--primary)]" /></label></section>
      <section className="rounded-xl bg-[var(--primary)] p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Besoin d’aide ?</p><h2 className="mt-2 text-xl font-black">Support DebitManager</h2><p className="mt-4 text-sm leading-6 text-white/65">Consultez les guides de configuration ou revenez au tableau de bord pour poursuivre vos opérations.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/dashboard" className="rounded-lg bg-[var(--secondary-container)] px-4 py-3 text-sm font-black text-[var(--primary)]">Retour au dashboard</Link><Link href="/dashboard/messages" className="rounded-lg border border-white/20 px-4 py-3 text-sm font-black text-white">Écrire à l’équipe</Link></div></section>
    </div>
  </section>;
}
