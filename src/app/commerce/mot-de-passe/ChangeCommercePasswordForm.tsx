"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
};

function PasswordField({ id, label, value, onChange, visible, onToggle, autoComplete }: PasswordFieldProps) {
  return <label htmlFor={id} className="block text-sm font-bold text-slate-800">
    {label}
    <span className="relative mt-2 block">
      <input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} required minLength={8} autoComplete={autoComplete} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-24 text-base text-slate-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" />
      <button type="button" onClick={onToggle} aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`} aria-pressed={visible} className="absolute inset-y-1 right-1 inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-black text-emerald-900 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mr-1.5 h-4 w-4"><path d="M2.5 12s3.2-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.2 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/>{!visible && <path d="m4 4 16 16"/>}</svg>
        {visible ? "Masquer" : "Afficher"}
      </button>
    </span>
  </label>;
}

export function ChangeCommercePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmation }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de changer le mot de passe.");
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de changer le mot de passe.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mt-7 space-y-5">
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p>}
    <PasswordField id="commerce-new-password" label="Nouveau mot de passe" value={password} onChange={setPassword} visible={passwordVisible} onToggle={() => setPasswordVisible((value) => !value)} autoComplete="new-password" />
    <PasswordField id="commerce-confirm-password" label="Confirmer le mot de passe" value={confirmation} onChange={setConfirmation} visible={confirmationVisible} onToggle={() => setConfirmationVisible((value) => !value)} autoComplete="new-password" />
    <p className="text-xs leading-5 text-slate-600">Utilisez au moins 8 caractères. Évitez un mot de passe déjà utilisé ailleurs.</p>
    <button type="submit" disabled={pending || password.length < 8 || confirmation.length < 8} className="min-h-12 w-full rounded-xl bg-emerald-900 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer et continuer"}</button>
  </form>;
}
