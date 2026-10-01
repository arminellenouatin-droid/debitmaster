import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { MagasinierClient } from "./MagasinierClient";

export default async function MagasinierPage() {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");
  if (!context.tenantId) redirect("/dashboard");

  const isOwner = context.role === "ADMINISTRATEUR" && context.employeeId === null;
  const isGerant = context.role === "GERANT" || context.role === "GERANT_ADJOINT";
  const isMagasinier = context.role === "MAGASINIER";

  if (!isOwner && !isGerant && !isMagasinier && !context.permissions.has("stock.view")) {
    redirect("/dashboard");
  }

  const firstName = context.user.user_metadata?.first_name ?? "Magasinier";

  return (
    <DashboardShell firstName={firstName}>
      <MagasinierClient tenantId={context.tenantId} userId={context.user.id} />
    </DashboardShell>
  );
}
