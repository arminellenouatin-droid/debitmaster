// DebitManager Power Repas: espace spécialisé cuisine, indépendant de l’espace Boissons.
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { MealKitchenClient } from "./MealKitchenClient";

export const dynamic = "force-dynamic";

export default async function MealsPage() {
  const context = await getAuthorizationContext();
  if (!context.user) redirect("/connexion");
  if (context.role !== "CHEF_CUISINE" && context.role !== "CUISINIER" && context.role !== "ADMINISTRATEUR") redirect("/dashboard");
  if (!context.tenantIds[0]) redirect("/dashboard");
  if (!can(context, "orders.view")) redirect("/dashboard");
  return <DashboardShell firstName={context.user.user_metadata?.first_name ?? "Cuisine"}><MealKitchenClient tenantId={context.tenantIds[0]} role={context.role === "CUISINIER" ? "CUISINIER" : "CHEF_CUISINE"} employeeId={context.employeeId} /></DashboardShell>;
}
