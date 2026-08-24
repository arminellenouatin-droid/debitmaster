// DebitManager / maquette connexion: identifiant unique email ou téléphone, feedback lisible et premier accès guidé.
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ConnexionForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Connexion impossible.");
      router.push(result.mustChangePassword ? "/dashboard/settings?firstLogin=1" : "/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mt-10 space-y-5">{error && <p role="alert" className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 font-sans text-sm text-[var(--accent)]">{error}</p>}<label className="block font-sans text-sm font-semibold">E-mail ou téléphone<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} type="text" required autoComplete="username" placeholder="vous@exemple.com ou +229…" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4" /></label><label className="block font-sans text-sm font-semibold">Mot de passe<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required autoComplete="current-password" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4" /></label><button disabled={pending} className="w-full rounded-full bg-[var(--ink)] px-5 py-3.5 font-sans text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Connexion en cours…" : "Se connecter"}</button></form>;
}
