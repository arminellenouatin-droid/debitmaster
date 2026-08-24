/* Maquette gestionpersonnel: route protégée et écran d’équipe relié à l’API employees. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { PersonnelClient } from "./PersonnelClient";
import { GerantClient } from "../GerantClient";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { getActiveTenantContext } from "@/lib/active-tenant";

export const dynamic = "force-dynamic";

export default async function PersonnelPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const authorization = await getAuthorizationContext();
  if (authorization.role === "GERANT" && can(authorization, "team.view")) {
    const active = await getActiveTenantContext();
    return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><GerantClient tenantId={active.tenantId ?? ""} firstName={auth.user.user_metadata?.first_name ?? "gérant"} companyName={active.company?.name ?? "Établissement actif"} initialTab="team" /></DashboardShell>;
  }
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><PersonnelClient /></DashboardShell>;
}
