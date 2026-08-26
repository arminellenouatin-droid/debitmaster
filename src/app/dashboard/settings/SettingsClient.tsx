// DebitManager account settings: clear profile editing, private avatar upload and explicit security states.
"use client";

import { FormEvent, ChangeEvent, useState } from "react";
import Link from "next/link";

type Props = { firstName: string; lastName: string; email: string; phone: string; avatarUrl: string | null; mustChangePassword: boolean };

export function SettingsClient({ firstName: initialFirstName, lastName: initialLastName, email: initialEmail, phone, avatarUrl: initialAvatarUrl, mustChangePassword }: Props) {
  const [compact, setCompact] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(mustChangePassword);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(initialEmail);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  function resetFeedback() { setError(""); setMessage(""); }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetFeedback(); setProfilePending(true);
    try {
      const response = await fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName, lastName, email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de mettre à jour le profil.");
      setMessage(result.emailConfirmationRequired ? "Profil enregistré. Confirmez le nouvel e-mail depuis votre boîte de réception pour l’activer." : "Profil mis à jour.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de mettre à jour le profil."); }
    finally { setProfilePending(false); }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    resetFeedback(); setAvatarPending(true);
    try {
      const body = new FormData(); body.append("avatar", file);
      const response = await fetch("/api/auth/profile/avatar", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer la photo.");
      setAvatarUrl(result.avatarUrl ?? null); setMessage("Photo de profil mise à jour.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer la photo."); }
    finally { setAvatarPending(false); event.target.value = ""; }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetFeedback(); setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmation }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de modifier le mot de passe.");
      setPassword(""); setConfirmation(""); setShowPasswordForm(false); setMessage("Mot de passe mis à jour. Votre accès est maintenant sécurisé.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de modifier le mot de passe."); }
    finally { setPending(false); }
  }

  const initials = `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase() || "U";
  return <section>
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Compte personnel</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--primary)]">Paramètres de votre compte</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Mettez à jour vos informations personnelles et sécurisez votre accès à DebitManager.</p></div>
    {mustChangePassword && <div className="mt-6 rounded-xl border-2 border-[var(--secondary)] bg-[var(--secondary-container)] p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--primary)]">Action requise</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Remplacez votre mot de passe temporaire</h2><p className="mt-2 text-sm leading-6 text-[var(--primary)]">Choisissez un mot de passe personnel avant d’utiliser durablement votre espace.</p></div>}
    {(error || message) && <p role={error ? "alert" : "status"} className={`mt-6 rounded-lg px-4 py-3 text-sm font-bold ${error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{error || message}</p>}
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-2"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Profil</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Informations personnelles</h2><form onSubmit={saveProfile} className="mt-6 grid gap-5 sm:grid-cols-2"><div className="flex items-center gap-4 sm:col-span-2"><div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-xl font-black text-[var(--primary)]">{avatarUrl ? <img src={avatarUrl} alt="Photo de profil" className="h-full w-full object-cover" /> : initials}</div><div><label className="inline-flex cursor-pointer rounded-lg border border-[var(--line)] px-4 py-3 text-sm font-black text-[var(--primary)]">{avatarPending ? "Envoi…" : "Choisir une photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={avatarPending} className="sr-only" /></label><p className="mt-2 text-xs text-[var(--muted)]">JPG, PNG ou WebP, 2 Mo maximum.</p></div></div><label className="text-sm font-bold text-[var(--primary)]">Prénom<input required minLength={2} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4" /></label><label className="text-sm font-bold text-[var(--primary)]">Nom<input required minLength={2} value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4" /></label><label className="text-sm font-bold text-[var(--primary)] sm:col-span-2">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4" /><span className="mt-2 block text-xs font-medium text-[var(--muted)]">Un changement d’e-mail peut nécessiter une confirmation.</span></label><p className="text-sm text-[var(--muted)] sm:col-span-2">Téléphone de connexion : <span className="font-bold text-[var(--primary)]">{phone || "Non renseigné"}</span></p><button disabled={profilePending} className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-start">{profilePending ? "Enregistrement…" : "Enregistrer le profil"}</button></form></section>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-2"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Sécurité</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Mot de passe</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Utilisez au moins 8 caractères et ne partagez jamais ce mot de passe.</p></div>{!showPasswordForm && <button type="button" onClick={() => setShowPasswordForm(true)} className="rounded-lg border border-[var(--line)] px-4 py-3 text-sm font-black text-[var(--primary)]">Modifier</button>}</div>{showPasswordForm && <form onSubmit={changePassword} className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[var(--primary)]">Nouveau mot de passe<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4" /></label><label className="text-sm font-bold text-[var(--primary)]">Confirmer le mot de passe<input required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4" /></label><button disabled={pending} className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white sm:col-span-2 sm:justify-self-start disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}</button></form>}</section>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Préférences</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Votre confort de travail</h2><label className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] p-4"><span><span className="block font-black text-[var(--primary)]">Vue compacte</span><span className="mt-1 block text-xs text-[var(--muted)]">Réduit l’espace entre les éléments des listes.</span></span><input type="checkbox" checked={compact} onChange={(event) => { setCompact(event.target.checked); setMessage("Préférence appliquée à cette session."); }} className="h-5 w-5 accent-[var(--primary)]" /></label></section>
      <section className="rounded-xl bg-[var(--primary)] p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Besoin d’aide ?</p><h2 className="mt-2 text-xl font-black">Support DebitManager</h2><p className="mt-4 text-sm leading-6 text-white/65">Revenez au tableau de bord pour poursuivre vos opérations.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/dashboard" className="rounded-lg bg-[var(--secondary-container)] px-4 py-3 text-sm font-black text-[var(--primary)]">Retour au dashboard</Link><Link href="/dashboard/messages" className="rounded-lg border border-white/20 px-4 py-3 text-sm font-black text-white">Écrire à l’équipe</Link></div></section>
    </div>
  </section>;
}
