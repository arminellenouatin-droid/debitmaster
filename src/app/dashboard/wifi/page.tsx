// DebitManager Power WIFI: restricted to the Gérant operating the WIFI activity.
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { WifiClient } from "./WifiClient";

export default async function WifiPage() {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");
  if (!context.tenantId || context.company?.activity_type !== "POWER" || !["GERANT", "SUPERVISEUR", "ADMINISTRATEUR"].includes(context.role ?? "") || !context.permissions.has("services.view")) redirect("/dashboard");
  return <DashboardShell firstName={context.user.user_metadata?.first_name ?? context.company?.name ?? "équipe"}><WifiClient tenantId={context.tenantId} /></DashboardShell>;
}
