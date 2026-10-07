import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { CoutureCatalogClient } from "./CoutureCatalogClient";
import { getCoutureContext } from "@/lib/couture-auth";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function CoutureCatalogPage() {
  const context = await getCoutureContext();
  if (!context.user) redirect("/connexion");
  if (!context.tenantId || context.accessMode === "BLOCKED") redirect("/dashboard");

  const canView = context.isOwner || context.permissions.has("catalog.view");
  if (!canView) redirect("/dashboard");
  const canManage = context.accessMode === "ACTIVE" && (context.isOwner || context.permissions.has("catalog.manage"));
  const firstName = typeof context.user.user_metadata?.first_name === "string" ? context.user.user_metadata.first_name : "équipe";

  return (
    <DashboardShell firstName={firstName}>
      <CoutureCatalogClient tenantId={context.tenantId} canManage={canManage} />
    </DashboardShell>
  );
}
