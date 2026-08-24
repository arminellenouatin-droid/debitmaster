// DebitManager invitation UX: client interaction is isolated from server-rendered route params and supports signup before acceptance.
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [signup, setSignup] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function updateSignup(field: keyof typeof signup, value: string) {
    setSignup((current) => ({ ...current, [field]: value }));
  }

  async function acceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error ?? "Impossible d’accepter l’invitation.");
      return;
    }
    setStatus("success");
    setMessage("Votre accès collaborateur est actif. Vous pouvez maintenant ouvrir votre espace.");
    window.setTimeout(() => router.push("/dashboard"), 700);
  }

  async function createInvitedAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...signup, invitationToken: token }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 202) {
      setStatus("error");
      setMessage(payload.error ?? "Impossible de créer le compte collaborateur.");
      return;
    }
    if (payload.invitationAccepted) {
      setStatus("success");
      setMessage("Votre compte est créé et votre accès collaborateur est actif.");
      window.setTimeout(() => router.push("/dashboard"), 700);
      return;
    }
    setStatus("error");
    setMessage(payload.needsEmailConfirmation ? "Votre compte est créé. Confirmez votre adresse e-mail, connectez-vous, puis revenez sur ce lien pour finaliser l’accès." : payload.error ?? "Compte créé. Connectez-vous, puis revenez sur ce lien pour finaliser l’accès.");
  }

  return (
    <div className="mt-8 space-y-8">
      <form className="space-y-4" onSubmit={acceptInvitation}>
        {status === "error" && <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{message}</p>}
        {status === "success" && <p role="status" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}
        <button disabled={!token || status === "loading"} className="w-full rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50" type="submit">{status === "loading" ? "Vérification en cours…" : "J’ai déjà un compte"}</button>
      </form>

      <div className="border-t border-white/10 pt-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Première connexion</p>
        <h2 className="mt-2 text-xl font-semibold">Créer mon compte collaborateur</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Utilisez exactement l’adresse qui a reçu l’invitation. Si la confirmation e-mail est activée, le rattachement sera finalisé après votre confirmation et votre connexion.</p>
        <form className="mt-5 space-y-4" onSubmit={createInvitedAccount}>
          <div className="grid gap-4 sm:grid-cols-2">
            <input required value={signup.firstName} onChange={(event) => updateSignup("firstName", event.target.value)} placeholder="Prénom" autoComplete="given-name" className="h-12 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-slate-500" />
            <input required value={signup.lastName} onChange={(event) => updateSignup("lastName", event.target.value)} placeholder="Nom" autoComplete="family-name" className="h-12 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-slate-500" />
          </div>
          <input required type="email" value={signup.email} onChange={(event) => updateSignup("email", event.target.value)} placeholder="E-mail invité" autoComplete="email" className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-slate-500" />
          <input required minLength={8} type="password" value={signup.password} onChange={(event) => updateSignup("password", event.target.value)} placeholder="Mot de passe · 8 caractères minimum" autoComplete="new-password" className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-slate-500" />
          <button disabled={!token || status === "loading"} className="w-full rounded-2xl border border-amber-300/60 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50" type="submit">Créer le compte et rejoindre l’équipe</button>
        </form>
      </div>
    </div>
  );
}
