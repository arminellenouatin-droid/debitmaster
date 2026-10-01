import { redirect } from "next/navigation";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { InventaireClient } from "./InventaireClient";

export default async function InventairePage() {
  const context = await getActiveTenantContext();

  if (!context.user) {
    redirect("/connexion");
  }

  const allowedRoles = ["INVENTAIRE", "GERANT", "ADMINISTRATEUR", "SUPERVISEUR"];
  const isAllowed =
    allowedRoles.includes(context.role || "") ||
    context.permissions.has("inventory.view") ||
    context.permissions.has("stock.view");

  if (!isAllowed) {
    redirect("/dashboard");
  }

  const canValidate =
    ["ADMINISTRATEUR", "GERANT", "SUPERVISEUR"].includes(context.role || "") ||
    context.permissions.has("inventory.validate");

  return (
    <InventaireClient
      tenantId={context.tenantId || ""}
      companyName={context.company?.name || "Boutique & Commerce"}
      userRole={context.role || "INVENTAIRE"}
      canValidate={canValidate}
    />
  );
}
