// DebitManager Power service sales route: only service operators and authorized Power managers.
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { ServiceSalesClient } from "./ServiceSalesClient";

export default async function ServiceSalesPage() {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");
  const role = context.role;
  if (!context.tenantId || context.company?.activity_type !== "POWER" || !["GYM", "LAVAGE", "AUBERGE", "SUPERVISEUR", "ADMINISTRATEUR"].includes(role)) redirect("/dashboard");
  const activityCode = role === "GYM" ? "GYM" : role === "LAVAGE" ? "LAVAGE" : role === "AUBERGE" ? "LODGING" : "GYM";
  return <DashboardShell firstName={context.user.user_metadata?.first_name ?? context.company?.name ?? "équipe"}><ServiceSalesClient tenantId={context.tenantId} activityCode={activityCode} /></DashboardShell>;
}
