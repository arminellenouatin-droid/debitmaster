// DebitMaster Commerce: page Espace Vendeur (devis, proformas et ventes commerce)
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { can } from "@/lib/authorization";
import { VendeurClient } from "./VendeurClient";

export const dynamic = "force-dynamic";

export default async function VendeurPage() {
  const activeContext = await getActiveTenantContext();
  if (!activeContext.user) redirect("/connexion");
  if (!activeContext.tenantId) redirect("/dashboard");

  const isAuthorized =
    activeContext.role === "ADMINISTRATEUR" ||
    activeContext.role === "GERANT" ||
    activeContext.role === "GERANT_ADJOINT" ||
    activeContext.role === "SUPERVISEUR" ||
    activeContext.role === "VENDEUR" ||
    can(activeContext, "quotes.view") ||
    can(activeContext, "orders.create");

  if (!isAuthorized) {
    redirect("/dashboard");
  }

  const sellerName = [
    activeContext.user.user_metadata?.first_name,
    activeContext.user.user_metadata?.last_name,
  ]
    .filter(Boolean)
    .join(" ") || "Vendeur";

  return (
    <DashboardShell firstName={activeContext.user.user_metadata?.first_name ?? "vendeur"}>
      <VendeurClient
        tenantId={activeContext.tenantId}
        companyName={activeContext.company?.name ?? "Mon Commerce"}
        sellerName={sellerName}
        isOwner={activeContext.role === "ADMINISTRATEUR"}
      />
    </DashboardShell>
  );
}
