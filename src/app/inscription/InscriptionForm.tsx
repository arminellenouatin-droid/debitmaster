// DebitManager product UI: inscription guidée avec validation client, feedback et redirection contrôlée.
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function InscriptionForm() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage(""); setPending(true);
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Inscription impossible.");
      if (result.needsEmailConfirmation) setMessage("Votre compte est créé. Consultez votre e-mail pour confirmer l’adresse avant de vous connecter.");
      else { router.push("/dashboard"); router.refresh(); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inscription impossible.");
    } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="mt-10 space-y-5">{error && <p role="alert" className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 font-sans text-sm text-[var(--accent)]">{error}</p>}{message && <p role="status" className="rounded-xl bg-[color:var(--success)]/10 px-4 py-3 font-sans text-sm text-[var(--success)]">{message}</p>}<div className="grid gap-5 sm:grid-cols-2"><label className="block font-sans text-sm font-semibold">Prénom<input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} type="text" required autoComplete="given-name" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4" /></label><label className="block font-sans text-sm font-semibold">Nom<input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} type="text" required autoComplete="family-name" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4" /></label></div><label className="block font-sans text-sm font-semibold">E-mail professionnel<input value={form.email} onChange={(event) => update("email", event.target.value)} type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4" /></label><label className="block font-sans text-sm font-semibold">Mot de passe<input value={form.password} onChange={(event) => update("password", event.target.value)} type="password" minLength={8} required autoComplete="new-password" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4" /></label><button disabled={pending} className="w-full rounded-full bg-[var(--accent)] px-5 py-3.5 font-sans text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Création en cours…" : "Créer mon compte"}</button></form>;
}
