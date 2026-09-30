import { redirect } from "next/navigation";
import { CommerceDashboardShell } from "@/components/CommerceDashboardShell";
import { getCommerceContext, canCommerce } from "@/lib/commerce-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CommerceCatalogClient } from "./CommerceCatalogClient";

export const dynamic = "force-dynamic";

export default async function CommerceCataloguePage() {
  const context = await getCommerceContext();
  if (!context.user) redirect("/connexion");
  if (!context.company || !context.tenantId || context.company.activity_type !== "BOUTIQUE_COMMERCE") redirect("/dashboard");
  if (!canCommerce(context, "catalog.view")) redirect("/dashboard?error=permission_catalogue");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const firstName = auth.user?.user_metadata?.first_name ?? "gérant";
  const role = context.isOwner ? "Promoteur / Propriétaire" : context.roles.map((item) => item.name).join(", ") || "Équipe Commerce";
  return <CommerceDashboardShell firstName={firstName} companyName={context.company.name} tenantId={context.tenantId} role={role} isOwner={context.isOwner} accessMode={context.accessMode} permissions={[...context.permissions]}>
    <CommerceCatalogClient tenantId={context.tenantId} isOwner={context.isOwner} permissions={[...context.permissions]} accessMode={context.accessMode} />
  </CommerceDashboardShell>;
}
