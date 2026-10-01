import { redirect } from "next/navigation";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { ApprovisionnementClient } from "./ApprovisionnementClient";

export default async function ApprovisionnementPage() {
  const context = await getActiveTenantContext();

  if (!context.user) {
    redirect("/connexion");
  }

  const allowedRoles = ["APPROVISIONNEMENT", "GERANT", "ADMINISTRATEUR", "SUPERVISEUR"];
  const isAllowed =
    allowedRoles.includes(context.role || "") ||
    context.permissions.has("procurement.view") ||
    context.permissions.has("stock.view");

  if (!isAllowed) {
    redirect("/dashboard");
  }

  return (
    <ApprovisionnementClient
      tenantId={context.tenantId || ""}
      companyName={context.company?.name || "Boutique & Commerce"}
      userRole={context.role || "APPROVISIONNEMENT"}
    />
  );
}
