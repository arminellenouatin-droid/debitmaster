// DebitManager Power Auberge: vue visuelle et temps réel de l’occupation des chambres.
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { RoomOccupancyClient } from "./RoomOccupancyClient";

export const dynamic = "force-dynamic";

export default async function OccupancyPage() {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");
  if (!context.tenantId || context.company?.activity_type !== "POWER") redirect("/dashboard");
  return <DashboardShell firstName={context.user.user_metadata?.first_name ?? "équipe"}><RoomOccupancyClient tenantId={context.tenantId} /></DashboardShell>;
}
