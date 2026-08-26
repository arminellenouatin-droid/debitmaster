/* Maquette prisedecommande: route protégée, shell persistent et terminal de commande tenant-aware. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { OrdersClient } from "./OrdersClient";
import { OwnerOrdersClient } from "./OwnerOrdersClient";
import { ServeurClient } from "../ServeurClient";
import { GerantClient } from "../GerantClient";
import { getAuthorizationContext } from "@/lib/authorization";
import { getActiveTenantContext } from "@/lib/active-tenant";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const params = await searchParams;
  const authorization = await getAuthorizationContext();
  if (authorization.role === "GERANT") {
    const active = await getActiveTenantContext();
    return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><GerantClient tenantId={active.tenantId ?? ""} firstName={auth.user.user_metadata?.first_name ?? "gérant"} companyName={active.company?.name ?? "Établissement actif"} /></DashboardShell>;
  }
  if (authorization.role === "SERVEUR") {
    const active = await getActiveTenantContext();
    return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><ServeurClient tenantId={active.tenantId ?? ""} firstName={auth.user.user_metadata?.first_name ?? "serveur"} companyName={active.company?.name ?? "Établissement actif"} initialTab="orders" /></DashboardShell>;
  }
  const active = await getActiveTenantContext();
  if (authorization.role === "ADMINISTRATEUR" || (authorization.role === "SUPERVISEUR" && active.company?.activity_type === "POWER")) return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "propriétaire"}><OwnerOrdersClient companyName={active.company?.name ?? "Établissement actif"} /></DashboardShell>;
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><OrdersClient initialTableLabel={params.table ?? ""} /></DashboardShell>;
}
