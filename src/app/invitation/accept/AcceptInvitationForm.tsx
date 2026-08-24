// DebitManager invitation UX: client interaction is isolated from server-rendered route params.
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

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

  return (
    <form className="mt-8 space-y-4" onSubmit={acceptInvitation}>
      {!token && <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">Le lien d’invitation est incomplet.</p>}
      {status === "error" && <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{message}</p>}
      {status === "success" && <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}
      {status !== "success" && <>
        <button disabled={!token || status === "loading"} className="w-full rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50" type="submit">{status === "loading" ? "Vérification en cours…" : "Accepter l’invitation"}</button>
        <p className="text-center text-xs leading-5 text-slate-400">Si vous n’êtes pas encore connecté, ouvrez d’abord votre session DebitManager, puis revenez sur ce lien.</p>
      </>}
    </form>
  );
}
