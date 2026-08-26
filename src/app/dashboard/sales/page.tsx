/* DebitManager Power owner sales route: owner-only reporting surface inside the active tenant. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { DashboardShell } from "@/components/DashboardShell";
import { SalesClient } from "./SalesClient";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const authorization = await getAuthorizationContext();
  const active = await getActiveTenantContext();
  if (authorization.role !== "ADMINISTRATEUR" || authorization.employeeId !== null || active.company?.activity_type !== "POWER") redirect("/dashboard");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "propriétaire"}><SalesClient companyName={active.company?.name ?? "Établissement actif"} /></DashboardShell>;
}
