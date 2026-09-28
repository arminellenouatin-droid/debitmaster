// DebitManager connexion: l’utilisateur choisit l’e-mail ou le téléphone.
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { PhoneField } from "@/components/PhoneField";
import { composePhone } from "@/lib/phone-countries";

type LoginMode = "EMAIL" | "PHONE";

export function ConnexionForm() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("EMAIL");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("BJ");
  const [nationalNumber, setNationalNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function selectMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const identifier = mode === "EMAIL" ? email : composePhone(countryCode, nationalNumber);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Connexion impossible.");
      const destination = result.mustChangePassword ? "/dashboard/settings?firstLogin=1" : result.space === "MASTER_ADMIN" ? "/admin" : result.space === "AFFILIATE" ? "/affilie" : "/dashboard";
      router.push(destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-5">
      {error && <p role="alert" className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 font-sans text-sm text-[var(--accent)]">{error}</p>}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-muted)] p-1" role="tablist" aria-label="Mode de connexion">
        {([["EMAIL", "E-mail"], ["PHONE", "Téléphone"]] as const).map(([value, label]) => <button type="button" role="tab" aria-selected={mode === value} key={value} onClick={() => selectMode(value)} className={`min-h-11 rounded-md px-3 py-2 text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--secondary)] ${mode === value ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted)]"}`}>{label}</button>)}
      </div>
      {mode === "EMAIL" ? <label className="block font-sans text-sm font-semibold">Adresse e-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="username" placeholder="vous@exemple.com" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label> : <PhoneField label="Numéro de téléphone" countryCode={countryCode} nationalNumber={nationalNumber} onCountryChange={setCountryCode} onNumberChange={setNationalNumber} hint="Choisissez le pays puis saisissez uniquement le numéro national." />}
      <label className="block font-sans text-sm font-semibold">Mot de passe<PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label>
      <div className="-mt-2 text-right"><Link href="/mot-de-passe-oublie" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--primary)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--secondary)]">Mot de passe oublié ?</Link></div>
      <button disabled={pending} className="min-h-12 w-full rounded-full bg-[var(--ink)] px-5 py-3.5 font-sans text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)] disabled:cursor-wait disabled:opacity-60">{pending ? "Connexion en cours…" : "Se connecter"}</button>
    </form>
  );
}
