/* DebitManager Power supervisor supply route: beverage purchasing workspace for the active tenant. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { DashboardShell } from "@/components/DashboardShell";
import { SupplyClient } from "./SupplyClient";

export const dynamic = "force-dynamic";

export default async function SupplyPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const authorization = await getAuthorizationContext();
  const active = await getActiveTenantContext();
  if (!(authorization.role === "ADMINISTRATEUR" || authorization.role === "SUPERVISEUR") || active.company?.activity_type !== "POWER") redirect("/dashboard");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "superviseur"}><SupplyClient tenantId={active.tenantId ?? ""} companyName={active.company?.name ?? "Établissement actif"} /></DashboardShell>;
}
