// DebitManager invitation UX: server-rendered route params keep the acceptance page compatible with Next.js prerendering.
import { AcceptInvitationForm } from "./AcceptInvitationForm";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const tokenValue = params.token;
  const token = Array.isArray(tokenValue) ? tokenValue[0] ?? "" : tokenValue ?? "";

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8">
      <section className="mx-auto flex min-h-[80vh] max-w-lg items-center">
        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">DebitManager · Accès équipe</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Rejoindre un établissement</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Cette invitation vous rattache à l’établissement choisi par son responsable. Vérifiez que vous êtes connecté avec l’adresse e-mail qui a reçu l’invitation.</p>
          <AcceptInvitationForm token={token} />
        </div>
      </section>
    </main>
  );
}
