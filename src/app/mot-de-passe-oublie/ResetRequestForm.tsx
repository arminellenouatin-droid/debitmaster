"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PhoneField } from "@/components/PhoneField";
import { PasswordInput } from "@/components/PasswordInput";
import { composePhone } from "@/lib/phone-countries";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type RecoveryMethod = "EMAIL" | "PHONE";

export function ResetRequestForm() {
  const [method, setMethod] = useState<RecoveryMethod>("EMAIL");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("BJ");
  const [nationalNumber, setNationalNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [step, setStep] = useState<"IDENTIFIER" | "SMS_CODE" | "EMAIL_SENT" | "DONE">("IDENTIFIER");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function selectMethod(next: RecoveryMethod) {
    setMethod(next);
    setError("");
    setStep("IDENTIFIER");
    setPhoneVerified(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (step === "IDENTIFIER" && method === "EMAIL") {
        const callbackUrl = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
        callbackUrl.searchParams.set("next", "/mot-de-passe/reinitialiser");
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: callbackUrl.toString() });
        if (resetError) throw new Error("Impossible d’envoyer le lien pour le moment. Réessayez plus tard.");
        setStep("EMAIL_SENT");
        return;
      }

      if (step === "IDENTIFIER" && method === "PHONE") {
        const normalizedPhone = composePhone(countryCode, nationalNumber);
        if (!normalizedPhone) throw new Error("Saisissez un numéro de téléphone international valide.");
        const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalizedPhone, options: { channel: "sms", shouldCreateUser: false } });
        if (otpError) throw new Error("Impossible d’envoyer le code SMS. Vérifiez le numéro ou réessayez plus tard.");
        setPhone(normalizedPhone);
        setStep("SMS_CODE");
        return;
      }

      if (step === "SMS_CODE") {
        if (password.length < 8 || password !== confirmation) throw new Error("Les deux mots de passe doivent être identiques et contenir au moins 8 caractères.");
        if (!phoneVerified) {
          const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: token.trim(), type: "sms" });
          if (verifyError) throw new Error("Code invalide ou expiré. Demandez un nouveau code puis réessayez.");
          setPhoneVerified(true);
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw new Error("Le mot de passe n’a pas pu être modifié. Vérifiez sa longueur et réessayez.");
        const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
        if (signOutError) await supabase.auth.signOut();
        setStep("DONE");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de réinitialiser le mot de passe.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl bg-[var(--surface)] p-6 shadow-[0_24px_60px_-32px_var(--primary)] sm:p-9" aria-labelledby="recovery-title">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Récupération du compte</p>
      <h1 id="recovery-title" className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--primary)]">Mot de passe oublié ?</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Choisissez l’adresse e-mail ou le numéro de téléphone associé à votre compte.</p>

      {error && <p role="alert" className="mt-5 rounded-lg bg-[#ffdad6] px-4 py-3 text-sm font-bold text-[var(--danger)]">{error}</p>}
      {step === "EMAIL_SENT" && <div role="status" className="mt-6 rounded-lg bg-[var(--accent-soft)] px-4 py-4 text-sm leading-6 text-[var(--primary)]">Si un compte correspond à cette adresse, un lien de réinitialisation vient d’être envoyé. Pensez à vérifier vos courriers indésirables.</div>}
      {step === "DONE" && <div role="status" className="mt-6 rounded-lg bg-[var(--accent-soft)] px-4 py-4 text-sm leading-6 text-[var(--primary)]">Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter avec le nouveau.</div>}

      {step === "IDENTIFIER" && <>
        <div className="mt-7 grid grid-cols-2 gap-2 rounded-lg bg-[var(--surface-muted)] p-1" role="tablist" aria-label="Mode de récupération">
          <button type="button" role="tab" aria-selected={method === "EMAIL"} onClick={() => selectMethod("EMAIL")} className={`min-h-11 rounded-md px-3 py-2 text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--secondary)] ${method === "EMAIL" ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted)]"}`}>E-mail</button>
          <button type="button" role="tab" aria-selected={method === "PHONE"} onClick={() => selectMethod("PHONE")} className={`min-h-11 rounded-md px-3 py-2 text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--secondary)] ${method === "PHONE" ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted)]"}`}>Téléphone</button>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-5">
          {method === "EMAIL" ? <label className="block text-sm font-bold text-[var(--primary)]">Adresse e-mail<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label> : <PhoneField label="Numéro de téléphone" countryCode={countryCode} nationalNumber={nationalNumber} onCountryChange={setCountryCode} onNumberChange={setNationalNumber} hint="Le numéro doit être celui associé au compte." />}
          <button disabled={pending} className="min-h-12 w-full rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)] disabled:cursor-wait disabled:opacity-60">{pending ? "Envoi en cours…" : method === "EMAIL" ? "Envoyer le lien" : "Envoyer le code SMS"}</button>
        </form>
      </>}

      {step === "SMS_CODE" && <form onSubmit={submit} className="mt-6 space-y-5">
        <p className="text-sm leading-6 text-[var(--muted)]">Un code à usage unique a été demandé pour le numéro {phone}.</p>
        <label className="block text-sm font-bold text-[var(--primary)]">Code reçu par SMS<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label>
        <label className="block text-sm font-bold text-[var(--primary)]">Nouveau mot de passe<PasswordInput required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label>
        <label className="block text-sm font-bold text-[var(--primary)]">Confirmer le nouveau mot de passe<PasswordInput required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]" /></label>
        <button disabled={pending} className="min-h-12 w-full rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)] disabled:cursor-wait disabled:opacity-60">{pending ? "Vérification…" : "Vérifier et modifier le mot de passe"}</button>
        <button type="button" onClick={() => { setStep("IDENTIFIER"); setPhoneVerified(false); setToken(""); }} className="min-h-11 w-full text-sm font-bold text-[var(--muted)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--secondary)]">Utiliser un autre numéro</button>
      </form>}

      <p className="mt-7 text-center text-sm font-bold text-[var(--muted)]"><Link href="/connexion" className="text-[var(--primary)] underline underline-offset-4">Retour à la connexion</Link></p>
    </section>
  );
}
