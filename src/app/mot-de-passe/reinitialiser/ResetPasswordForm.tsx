"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8 || password !== confirmation) {
      setError("Les deux mots de passe doivent être identiques et contenir au moins 8 caractères.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/complete-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Le lien de réinitialisation est invalide ou expiré.");
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de modifier le mot de passe.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl bg-[var(--surface)] p-6 shadow-[0_24px_60px_-32px_var(--primary)] sm:p-9" aria-labelledby="new-password-title">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Sécurité du compte</p>
      <h1 id="new-password-title" className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--primary)]">Choisir un nouveau mot de passe</h1>
      {complete ? <div role="status" className="mt-6 rounded-lg bg-[var(--accent-soft)] px-4 py-4 text-sm leading-6 text-[var(--primary)]">Votre mot de passe a été modifié. Vous pouvez vous reconnecter.</div> : <>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Choisissez un mot de passe d’au moins 8 caractères.</p>
        {error && <p role="alert" className="mt-5 rounded-lg bg-[#ffdad6] px-4 py-3 text-sm font-bold text-[var(--danger)]">{error}</p>}
        <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="block text-sm font-bold text-[var(--primary)]">Nouveau mot de passe<PasswordInput required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label>
          <label className="block text-sm font-bold text-[var(--primary)]">Confirmer le nouveau mot de passe<PasswordInput required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label>
          <button disabled={pending} className="min-h-12 w-full rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)] disabled:cursor-wait disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}</button>
        </form>
      </>}
      <p className="mt-7 text-center text-sm font-bold text-[var(--muted)]"><Link href="/connexion" onClick={() => { if (complete) router.refresh(); }} className="text-[var(--primary)] underline underline-offset-4">Retour à la connexion</Link></p>
    </section>
  );
}
