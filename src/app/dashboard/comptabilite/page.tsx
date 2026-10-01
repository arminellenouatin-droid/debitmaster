import { redirect } from "next/navigation";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { DashboardShell } from "@/components/DashboardShell";
import { ComptabiliteClient } from "./ComptabiliteClient";

export const dynamic = "force-dynamic";

export default async function ComptabilitePage() {
  const context = await getActiveTenantContext();

  if (!context.user) {
    redirect("/connexion");
  }

  const allowedRoles = ["COMPTABLE", "GERANT", "ADMINISTRATEUR", "SUPERVISEUR"];
  const isAllowed =
    allowedRoles.includes(context.role || "") ||
    context.permissions.has("accounting.view") ||
    context.permissions.has("finance.view");

  if (!isAllowed) {
    redirect("/dashboard");
  }

  const canPostEntries =
    ["COMPTABLE", "GERANT", "ADMINISTRATEUR", "SUPERVISEUR"].includes(context.role || "") ||
    context.permissions.has("accounting.entry");

  return (
    <DashboardShell firstName={context.user.user_metadata?.first_name ?? "comptable"}>
      <ComptabiliteClient
        tenantId={context.tenantId || ""}
        companyName={context.company?.name || "Boutique & Commerce"}
        userRole={context.role || "COMPTABLE"}
        canPostEntries={canPostEntries}
      />
    </DashboardShell>
  );
}
