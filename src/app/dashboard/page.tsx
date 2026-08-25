/* DebitManager owner dashboard: the active establishment replaces onboarding once setup is complete. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { DashboardClient } from "./DashboardClient";
import { ServeurClient } from "./ServeurClient";
import { getAuthorizationContext } from "@/lib/authorization";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { GerantClient } from "./GerantClient";
import { MagasinierClient } from "./MagasinierClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const firstName = auth.user.user_metadata?.first_name ?? "gérant";
  const authorization = await getAuthorizationContext();
  const requestedTab = (await searchParams).tab;
  const serverTab = requestedTab === "orders" || requestedTab === "encaissement" || requestedTab === "treasury" || requestedTab === "permanence" || requestedTab === "profile" ? requestedTab : "dashboard";
  const active = await getActiveTenantContext();
  if (authorization.role === "SERVEUR") return <DashboardShell firstName={firstName}><ServeurClient tenantId={active.tenantId ?? ""} firstName={firstName} companyName={active.company?.name ?? "Établissement actif"} initialTab={serverTab} /></DashboardShell>;
  if (authorization.role === "GERANT") return <DashboardShell firstName={firstName}><GerantClient tenantId={active.tenantId ?? ""} firstName={firstName} companyName={active.company?.name ?? "Établissement actif"} /></DashboardShell>;
  if (authorization.role === "MAGASINIER") {
    const { data: employee } = authorization.employeeId ? await authorization.supabase.from("employees").select("stock_scope").eq("id", authorization.employeeId).maybeSingle() : { data: null };
    return <DashboardShell firstName={firstName}><MagasinierClient stockScope={employee?.stock_scope ?? "BOTH"} firstName={firstName} companyName={active.company?.name ?? "Établissement actif"} /></DashboardShell>;
  }
  return <DashboardShell firstName={firstName}><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Pilotage de votre établissement</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--primary)]">Bonjour, {firstName}.</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Retrouvez ici l’activité réelle de l’établissement actif, ses performances et ses signaux opérationnels.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-black text-[var(--primary)]"><span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Données synchronisées</span></div><DashboardClient /></DashboardShell>;
}
