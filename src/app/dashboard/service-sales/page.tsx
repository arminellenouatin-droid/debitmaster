// DebitManager Power service sales route: activity assignment decides the service workspace.
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ServiceSalesClient } from "./ServiceSalesClient";

export default async function ServiceSalesPage() {
  const context = await getActiveTenantContext();
  if (!context.user) redirect("/connexion");
  let activityCode: "GYM" | "LAVAGE" | "LODGING" | null = context.role === "GYM" ? "GYM" : context.role === "LAVAGE" ? "LAVAGE" : context.role === "AUBERGE" ? "LODGING" : null;
  if (!activityCode && context.employeeId && context.tenantId) {
    const admin = createSupabaseAdminClient();
    const { data: assignment } = await admin.from("employee_activity_assignments").select("activity_id").eq("employee_id", context.employeeId).eq("tenant_id", context.tenantId).eq("is_active", true).limit(1).maybeSingle();
    if (assignment?.activity_id) {
      const { data: activity } = await admin.from("company_activities").select("activity_code").eq("id", assignment.activity_id).eq("tenant_id", context.tenantId).maybeSingle();
      if (activity?.activity_code === "GYM" || activity?.activity_code === "LAUNDRY" || activity?.activity_code === "LODGING") activityCode = activity.activity_code === "LAUNDRY" ? "LAVAGE" : activity.activity_code;
    }
  }
  if (!context.tenantId || context.company?.activity_type !== "POWER" || !activityCode) redirect("/dashboard");
  return <DashboardShell firstName={context.user.user_metadata?.first_name ?? context.company?.name ?? "équipe"}><ServiceSalesClient tenantId={context.tenantId} activityCode={activityCode} /></DashboardShell>;
}
