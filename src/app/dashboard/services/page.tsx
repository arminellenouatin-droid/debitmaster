// DebitManager Power services: liste des prestations de l’activité courante, sans mélange avec les stocks boissons ou cuisine.
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { ServiceCatalogClient } from "./ServiceCatalogClient";

export const dynamic = "force-dynamic";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ activity?: string }> }) {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");
  const activity = (await searchParams).activity === "LAVAGE" ? "LAVAGE" : "GYM";
  const assigned = context.role === "GYM" || context.role === "LAVAGE" || context.role === "ADMINISTRATEUR" || context.role === "SUPERVISEUR";
  if (!context.tenantId || context.company?.activity_type !== "POWER" || !assigned) redirect("/dashboard");
  return <DashboardShell firstName={context.user.user_metadata?.first_name ?? "équipe"}><ServiceCatalogClient tenantId={context.tenantId} activityCode={activity} /></DashboardShell>;
}
