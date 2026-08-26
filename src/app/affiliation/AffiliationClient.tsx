// Design Read: parcours public d’affiliation, clair et mobile-first, avec une action principale nette, des labels persistants et une séparation stricte avec l’espace établissement.
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signup" | "login";

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
};

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  password: "",
};

export function AffiliationClient({ firstName = "" }: { firstName?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(firstName ? "signup" : "signup");
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPending(true);

    try {
      if (mode === "signup") {
        const response = await fetch("/api/auth/affiliate-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error ?? "Inscription affiliée impossible.");
        if (result?.needsLogin) {
          setMode("login");
          setNotice(result.message ?? "Compte affilié créé. Connectez-vous pour ouvrir votre espace.");
          return;
        }
        router.push("/affilie");
        router.refresh();
        return;
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.email || form.phone, password: form.password }),
      });
      const loginResult = await loginResponse.json().catch(() => null);
      if (!loginResponse.ok) throw new Error(loginResult?.error ?? "Identifiant ou mot de passe incorrect.");

      if (loginResult?.space === "AFFILIATE") {
        router.push("/affilie");
        router.refresh();
        return;
      }

      const joinResponse = await fetch("/api/affiliate/join", { method: "POST" });
      const joinResult = await joinResponse.json().catch(() => null);
      if (!joinResponse.ok) throw new Error(joinResult?.error ?? "Ce compte ne peut pas rejoindre le programme affilié.");
      setNotice("Votre compte rejoint le programme affilié. Votre espace va s’ouvrir.");
      router.push("/affilie");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de terminer le parcours affilié.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
      <div className="max-w-lg">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Programme commercial DebitManager</p>
        <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-[-0.045em] text-[var(--primary)] sm:text-5xl">Apportez des établissements. Suivez vos commissions.</h1>
        <p className="mt-6 text-base leading-7 text-[var(--muted)]">Le compte affilié est destiné aux personnes qui présentent DebitManager aux bars, restaurants et établissements de leur réseau. Aucun établissement n’est nécessaire pour commencer.</p>
        <div className="mt-9 border-y border-[var(--line)]">
          <div className="flex gap-4 border-b border-[var(--line)] py-5">
            <span className="text-sm font-black text-[var(--secondary)]">01</span>
            <div><h2 className="font-black text-[var(--primary)]">Recevez votre lien</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Après votre adhésion, votre lien personnel est disponible dans votre espace affilié.</p></div>
          </div>
          <div className="flex gap-4 border-b border-[var(--line)] py-5">
            <span className="text-sm font-black text-[var(--secondary)]">02</span>
            <div><h2 className="font-black text-[var(--primary)]">Présentez le SaaS</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Partagez le lien aux responsables qui souhaitent créer leur espace d’établissement.</p></div>
          </div>
          <div className="flex gap-4 py-5">
            <span className="text-sm font-black text-[var(--secondary)]">03</span>
            <div><h2 className="font-black text-[var(--primary)]">Suivez 10 %</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Chaque abonnement confirmé de vos établissements attribués alimente vos commissions, renouvellements compris.</p></div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_42px_-30px_var(--primary)] sm:p-8" aria-labelledby="affiliate-form-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Accès affilié</p><h2 id="affiliate-form-title" className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--primary)]">{mode === "signup" ? "Créer mon compte affilié" : "Ouvrir mon compte"}</h2></div>
          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--primary)]">Commission : 10 %</span>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-2 rounded-lg bg-[var(--surface-muted)] p-1" role="tablist" aria-label="Choix du parcours">
          <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")} className={`min-h-11 rounded-md px-3 py-2 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-[var(--secondary)] ${mode === "signup" ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted)]"}`}>Créer un compte</button>
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")} className={`min-h-11 rounded-md px-3 py-2 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-[var(--secondary)] ${mode === "login" ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted)]"}`}>J’ai déjà un compte</button>
        </div>

        {error && <p role="alert" className="mt-5 rounded-lg bg-[#ffdad6] px-4 py-3 text-sm font-bold text-[var(--danger)]">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-lg bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--primary)]">{notice}</p>}

        <form onSubmit={submit} className="mt-7 space-y-5">
          {mode === "signup" && <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold text-[var(--primary)]">Prénom<input required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} autoComplete="given-name" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label><label className="block text-sm font-bold text-[var(--primary)]">Nom<input required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} autoComplete="family-name" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label></div>}
          {mode === "signup" && <label className="block text-sm font-bold text-[var(--primary)]">Téléphone<input required value={form.phone} onChange={(event) => update("phone", event.target.value)} type="tel" autoComplete="tel" placeholder="+229 01 23 45 67 89" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label>}
          <label className="block text-sm font-bold text-[var(--primary)]">E-mail<input required={!form.phone || mode === "signup"} value={form.email} onChange={(event) => update("email", event.target.value)} type="email" autoComplete="email" placeholder="vous@exemple.com" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label>
          {mode === "login" && <label className="block text-sm font-bold text-[var(--primary)]">Ou téléphone<input required={!form.email} value={form.phone} onChange={(event) => update("phone", event.target.value)} type="tel" autoComplete="username" placeholder="+229 01 23 45 67 89" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label>}
          <label className="block text-sm font-bold text-[var(--primary)]">Mot de passe<input required value={form.password} onChange={(event) => update("password", event.target.value)} type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" />{mode === "signup" && <span className="mt-2 block text-xs font-medium text-[var(--muted)]">8 caractères minimum.</span>}</label>
          <button disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white transition hover:bg-[var(--primary-soft)] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--secondary)] disabled:cursor-wait disabled:opacity-60">{pending ? "Traitement en cours…" : mode === "signup" ? "Rejoindre le programme" : "Accéder à mon espace"}<span aria-hidden>→</span></button>
        </form>
        <p className="mt-5 text-xs leading-5 text-[var(--muted)]">L’affiliation ne crée pas d’établissement à votre nom. Le lien est généré après l’adhésion et les commissions sont enregistrées uniquement sur les abonnements confirmés.</p>
      </section>
    </div>
  );
}
