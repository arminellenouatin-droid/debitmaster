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

  const isAllowed =
    Boolean(context.user) &&
    (Boolean(context.tenantId) || context.tenantIds.length > 0 || Boolean(context.company));

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
          <RapportsClient
            tenantId={commerce.tenantId}
            companyName={commerce.company.name}
            userRole={context.role || "COMMERCE_STAFF"}
          />
        </CommerceDashboardShell>
      );
    }
  }

  return (
    <DashboardShell firstName={firstName}>
      <RapportsClient
        tenantId={context.tenantId || ""}
        companyName={context.company?.name || "Établissement actif"}
        userRole={context.role || (context.allTenantIds.length ? "ADMINISTRATEUR" : "MEMBRE")}
      />
    </DashboardShell>
  );
}
