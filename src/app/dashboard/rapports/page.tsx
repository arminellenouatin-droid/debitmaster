import { redirect } from "next/navigation";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { DashboardShell } from "@/components/DashboardShell";
import { RapportsClient } from "./RapportsClient";
import { CommerceDashboardShell } from "@/components/CommerceDashboardShell";
import { getCommerceContext } from "@/lib/commerce-auth";

export const dynamic = "force-dynamic";

export default async function RapportsPage() {
  const context = await getActiveTenantContext();

  if (!context.user) {
    redirect("/connexion");
  }

  const allowedRoles = ["GERANT", "ADMINISTRATEUR", "COMPTABLE", "SUPERVISEUR"];
  const isAllowed =
    allowedRoles.includes(context.role || "") ||
    context.permissions.has("reports.view") ||
    context.permissions.has("reports.analytics");

  if (!isAllowed) {
    redirect("/dashboard");
  }

  const firstName = context.user.user_metadata?.first_name ?? "gérant";

  // If Commerce activity
  if (context.company?.activity_type === "BOUTIQUE_COMMERCE" || context.role === "COMMERCE_STAFF") {
    const commerce = await getCommerceContext(context.role === "COMMERCE_STAFF" ? undefined : context.tenantId ?? undefined);
    if (commerce.company && commerce.tenantId) {
      const role = commerce.isOwner ? "Promoteur / Propriétaire" : commerce.roles.map((item) => item.name).join(", ") || "Équipe Commerce";
      return (
        <CommerceDashboardShell
          firstName={firstName}
          companyName={commerce.company.name}
          tenantId={commerce.tenantId}
          role={role}
          isOwner={commerce.isOwner}
          accessMode={commerce.accessMode}
          permissions={[...commerce.permissions]}
        >
          <RapportsClient tenantId={commerce.tenantId} companyName={commerce.company.name} />
        </CommerceDashboardShell>
      );
    }
  }

  return (
    <DashboardShell firstName={firstName}>
      <RapportsClient
        tenantId={context.tenantId || ""}
        companyName={context.company?.name || "Établissement actif"}
      />
    </DashboardShell>
  );
}
