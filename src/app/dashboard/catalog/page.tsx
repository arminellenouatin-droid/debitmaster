// DebitManager: Gestion consolidée des Produits et Services (Boissons, Repas, Accompagnements, Auberge, Gym, Lavage, Wi-Fi).
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { can } from "@/lib/authorization";
import { CatalogManagerClient } from "./CatalogManagerClient";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");

  const isAllowed =
    context.role === "ADMINISTRATEUR" ||
    context.role === "SUPERVISEUR" ||
    context.role === "GERANT" ||
    context.role === "GERANT_ADJOINT" ||
    context.role === "MAGASINIER" ||
    context.role === "CHEF_CUISINE" ||
    can(context, "products.manage") ||
    can(context, "services.manage") ||
    can(context, "stock.view");

  if (!context.tenantId || !isAllowed) {
    redirect("/dashboard");
  }

  const isPower = context.company?.activity_type === "POWER";
  const canManage =
    context.role === "ADMINISTRATEUR" ||
    context.role === "SUPERVISEUR" ||
    context.role === "GERANT" ||
    can(context, "products.manage") ||
    can(context, "services.manage");

  return (
    <DashboardShell firstName={context.user.user_metadata?.first_name ?? "équipe"}>
      <CatalogManagerClient
        tenantId={context.tenantId}
        companyName={context.company?.name ?? "Établissement"}
        isPower={isPower}
        canManage={canManage}
        userRole={context.role ?? "MEMBRE"}
      />
    </DashboardShell>
  );
}
