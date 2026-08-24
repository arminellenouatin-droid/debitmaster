// DebitManager product UI: formulaire d’accès avec feedback local, sans exposer de secret ni de détail technique.
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ConnexionForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Connexion impossible.");
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mt-10 space-y-5">{error && <p role="alert" className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 font-sans text-sm text-[var(--accent)]">{error}</p>}<label className="block font-sans text-sm font-semibold">E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4" /></label><label className="block font-sans text-sm font-semibold">Mot de passe<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required autoComplete="current-password" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4" /></label><button disabled={pending} className="w-full rounded-full bg-[var(--ink)] px-5 py-3.5 font-sans text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Connexion en cours…" : "Se connecter"}</button></form>;
}
