import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { PersonnelClient } from "./PersonnelClient";
import { CommercePersonnelClient } from "./CommercePersonnelClient";
import { CommerceDashboardShell } from "@/components/CommerceDashboardShell";
import { GerantClient } from "../GerantClient";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { getCommerceContext } from "@/lib/commerce-auth";

export const dynamic = "force-dynamic";

export default async function PersonnelPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const authorization = await getAuthorizationContext();
  const active = await getActiveTenantContext();

  if (active.company?.activity_type === "BOUTIQUE_COMMERCE" || authorization.role === "COMMERCE_STAFF") {
    const commerce = await getCommerceContext(authorization.role === "COMMERCE_STAFF" ? undefined : active.tenantId ?? undefined);
    if (commerce.company && commerce.tenantId) {
      const role = commerce.isOwner ? "Promoteur / Propriétaire" : commerce.roles.map((item) => item.name).join(", ") || "Équipe Commerce";
      const firstName = auth.user.user_metadata?.first_name ?? "gérant";
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
          <CommercePersonnelClient tenantId={commerce.tenantId} isOwner={commerce.isOwner} />
        </CommerceDashboardShell>
      );
    }
  }

  if (authorization.role === "GERANT" && can(authorization, "team.view")) {
    return (
      <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}>
        <GerantClient
          tenantId={active.tenantId ?? ""}
          firstName={auth.user.user_metadata?.first_name ?? "gérant"}
          companyName={active.company?.name ?? "Établissement actif"}
          initialTab="team"
        />
      </DashboardShell>
    );
  }
  return (
    <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}>
      <PersonnelClient />
    </DashboardShell>
  );
}

