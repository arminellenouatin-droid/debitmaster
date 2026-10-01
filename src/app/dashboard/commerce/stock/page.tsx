import { redirect } from "next/navigation";
import { CommerceDashboardShell } from "@/components/CommerceDashboardShell";
import { canCommerce, getCommerceContext } from "@/lib/commerce-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CommerceStockClient } from "./CommerceStockClient";

export const dynamic = "force-dynamic";

export default async function CommerceStockPage() {
  const context = await getCommerceContext();
  if (!context.user) redirect("/connexion");
  if (!context.company || !context.tenantId || context.company.activity_type !== "BOUTIQUE_COMMERCE") redirect("/dashboard");
  if (!canCommerce(context, "stock.view")) redirect("/dashboard?error=permission_stock");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const firstName = auth.user?.user_metadata?.first_name ?? "gérant";
  const role = context.isOwner ? "Promoteur / Propriétaire" : context.roles.map((item) => item.name).join(", ") || "Équipe Commerce";
  return <CommerceDashboardShell firstName={firstName} companyName={context.company.name} tenantId={context.tenantId} role={role} isOwner={context.isOwner} accessMode={context.accessMode} permissions={[...context.permissions]}>
    <CommerceStockClient
      tenantId={context.tenantId}
      isOwner={context.isOwner}
      canWrite={context.accessMode === "ACTIVE"}
      canReceive={canCommerce(context, "stock.receive")}
      canIssue={canCommerce(context, "stock.issue")}
      canManage={canCommerce(context, "stock.manage")}
    />
  </CommerceDashboardShell>;
}
