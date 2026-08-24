/* Maquette prisedecommande: route protégée, shell persistent et terminal de commande tenant-aware. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { OrdersClient } from "./OrdersClient";
import { ServeurClient } from "../ServeurClient";
import { getAuthorizationContext } from "@/lib/authorization";
import { getActiveTenantContext } from "@/lib/active-tenant";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const params = await searchParams;
  const authorization = await getAuthorizationContext();
  if (authorization.role === "SERVEUR") {
    const active = await getActiveTenantContext();
    return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><ServeurClient tenantId={active.tenantId ?? ""} firstName={auth.user.user_metadata?.first_name ?? "serveur"} companyName={active.company?.name ?? "Établissement actif"} initialTab="orders" /></DashboardShell>;
  }
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><OrdersClient initialTableLabel={params.table ?? ""} /></DashboardShell>;
}
