import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { CaissierClient } from "./CaissierClient";

export default async function CaissierPage() {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");
  if (!context.tenantId) redirect("/dashboard");

  const isOwner = context.role === "ADMINISTRATEUR" && context.employeeId === null;
  const isGerant = context.role === "GERANT" || context.role === "GERANT_ADJOINT";
  const isCaissier = context.role === "CAISSIER";

  if (!isOwner && !isGerant && !isCaissier && !context.permissions.has("finance.view")) {
    redirect("/dashboard");
  }

  const firstName = context.user.user_metadata?.first_name ?? "Caissier";

  return (
    <DashboardShell firstName={firstName}>
      <CaissierClient tenantId={context.tenantId} userId={context.user.id} />
    </DashboardShell>
  );
}
