/* Maquette inscription: carte claire, formulaire en deux temps, champs lisibles, confirmation explicite et boutons tactiles. */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function InscriptionForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "" });
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
      if (result.needsEmailConfirmation) {
        setStep(2);
        setMessage("Votre compte est créé. Consultez votre e-mail pour confirmer votre adresse.");
      } else {
        router.push("/choixprofil");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inscription impossible.");
    } finally { setPending(false); }
  }

  return <div className="w-full max-w-xl rounded-xl bg-[var(--surface)] p-6 shadow-[0_24px_60px_-32px_var(--primary)] sm:p-9">
    <div className="mb-8 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">DebitManager Pro</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--primary)]">Créer un compte</h1></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--primary)]">{step}/2</span></div>
    <div className="mb-8 flex gap-2"><span className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-[var(--primary)]" : "bg-[var(--surface-high)]"}`} /><span className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-[var(--primary)]" : "bg-[var(--surface-high)]"}`} /></div>
    {error && <p role="alert" className="mb-5 rounded-lg bg-[#ffdad6] px-4 py-3 text-sm font-bold text-[var(--danger)]">{error}</p>}
    {message && <p role="status" className="mb-5 rounded-lg bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--primary)]">{message}</p>}
    {step === 1 ? <form onSubmit={submit} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold text-[var(--ink)]">Prénom<input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} required autoComplete="given-name" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 outline-none transition focus:border-[var(--primary)]" /></label><label className="block text-sm font-bold text-[var(--ink)]">Nom<input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} required autoComplete="family-name" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 outline-none transition focus:border-[var(--primary)]" /></label></div><label className="block text-sm font-bold text-[var(--ink)]">Numéro de téléphone<input value={form.phone} onChange={(event) => update("phone", event.target.value)} required type="tel" autoComplete="tel" placeholder="+225 01 23 45 67 89" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 outline-none transition focus:border-[var(--primary)]" /></label><label className="block text-sm font-bold text-[var(--ink)]">E-mail professionnel<input value={form.email} onChange={(event) => update("email", event.target.value)} required type="email" autoComplete="email" placeholder="vous@entreprise.com" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 outline-none transition focus:border-[var(--primary)]" /></label><label className="block text-sm font-bold text-[var(--ink)]">Mot de passe<input value={form.password} onChange={(event) => update("password", event.target.value)} required type="password" minLength={8} autoComplete="new-password" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 outline-none transition focus:border-[var(--primary)]" /><span className="mt-2 block text-xs font-medium text-[var(--muted)]">8 caractères minimum.</span></label><button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-black text-white transition hover:bg-[var(--primary-soft)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">{pending ? "Création en cours…" : "Continuer"}<span aria-hidden>→</span></button></form> : <div className="space-y-6"><div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-5"><p className="text-sm font-bold text-[var(--primary)]">Confirmation nécessaire</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Un message de confirmation a été demandé pour {form.email}. Après confirmation, revenez vous connecter pour poursuivre la configuration de votre établissement.</p></div><button type="button" onClick={() => router.push("/connexion")} className="flex h-12 w-full items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-black text-white transition hover:bg-[var(--primary-soft)]">Aller à la connexion</button><button type="button" onClick={() => setStep(1)} className="w-full text-sm font-bold text-[var(--muted)] hover:text-[var(--primary)]">Modifier mes informations</button></div>}
  </div>;
}
