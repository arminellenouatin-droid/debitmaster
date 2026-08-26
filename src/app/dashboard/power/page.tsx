// DebitManager Power: module réservé à un établissement dont activity_type vaut POWER et à un profil habilité.
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { PowerClient } from "./PowerClient";

export default async function PowerPage() {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");
  if (!context.tenantId || context.company?.activity_type !== "POWER" || !context.permissions.has("power.view")) redirect("/dashboard");
  return <DashboardShell firstName={context.user.user_metadata?.first_name ?? context.company?.name ?? "équipe"}><PowerClient tenantId={context.tenantId} isOwner={context.employeeId === null && context.role === "ADMINISTRATEUR"} /></DashboardShell>;
}
