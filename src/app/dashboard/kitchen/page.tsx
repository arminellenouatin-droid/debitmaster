/* Maquette fildattentecuisine: route protégée et file d’attente cuisine reliée aux commandes du tenant. */
import { redirect } from "next/navigation";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { DashboardShell } from "@/components/DashboardShell";
import { KitchenClient } from "./KitchenClient";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const context = await getAuthorizationContext();
  if (!context.user) redirect("/connexion");
  return <DashboardShell firstName={context.user.user_metadata?.first_name ?? "gérant"}><KitchenClient canPrepare={can(context, "orders.prepare")} canDeliver={can(context, "orders.deliver")} /></DashboardShell>;
}
