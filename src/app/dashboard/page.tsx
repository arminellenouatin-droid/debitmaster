/* DebitManager owner dashboard: the active establishment replaces onboarding once setup is complete. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const firstName = auth.user.user_metadata?.first_name ?? "gérant";
  return <DashboardShell firstName={firstName}><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Pilotage de votre établissement</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--primary)]">Bonjour, {firstName}.</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Retrouvez ici l’activité réelle de l’établissement actif, ses performances et ses signaux opérationnels.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-black text-[var(--primary)]"><span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Données synchronisées</span></div><DashboardClient /></DashboardShell>;
}
