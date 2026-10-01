import { redirect } from "next/navigation";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { DashboardShell } from "@/components/DashboardShell";
import { FinanceClient } from "./FinanceClient";
import { FinanceCockpitClient } from "./FinanceCockpitClient";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");

  const allowedRoles = ["ADMINISTRATEUR", "GERANT", "SUPERVISEUR", "COMPTABLE", "CAISSIER"];
  const isAllowed =
    allowedRoles.includes(context.role || "") ||
    context.permissions.has("finance.view") ||
    context.permissions.has("treasury.view");

  if (!isAllowed) {
    redirect("/dashboard");
  }

  const isCommerce = context.company?.activity_type === "BOUTIQUE_COMMERCE";
  const canApprove =
    ["ADMINISTRATEUR", "GERANT", "SUPERVISEUR"].includes(context.role || "") ||
    context.permissions.has("expenses.approve");

  return (
    <DashboardShell firstName={context.user.user_metadata?.first_name ?? "responsable"}>
      {isCommerce ? (
        <FinanceCockpitClient
          tenantId={context.tenantId || ""}
          companyName={context.company?.name || "Boutique & Commerce"}
          userRole={context.role || "COMPTABLE"}
          canApproveExpenses={canApprove}
        />
      ) : (
        <FinanceClient />
      )}
    </DashboardShell>
  );
}
