/* Maquette plandesalle: route protégée, navigation persistante et plan de salle relié aux commandes du tenant. */
import { redirect } from "next/navigation";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { DashboardShell } from "@/components/DashboardShell";
import { TablesClient } from "./TablesClient";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const context = await getAuthorizationContext();
  if (!context.user) redirect("/connexion");
  return <DashboardShell firstName={context.user.user_metadata?.first_name ?? "gérant"}><TablesClient canManage={can(context, "tables.manage")} /></DashboardShell>;
}
