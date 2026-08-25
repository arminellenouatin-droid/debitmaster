// DebitManager settings page: owner-only subscription controls are bound to the validated active tenant.
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { DashboardShell } from "@/components/DashboardShell";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

type SettingsPageProps = { searchParams: Promise<{ firstLogin?: string }> };

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const activeContext = await getActiveTenantContext();
  const { data: employee } = await supabase.from("employees").select("must_change_password,status").eq("user_id", auth.user.id).is("deleted_at", null).maybeSingle();
  const params = await searchParams;
  const mustChangePassword = Boolean(employee?.must_change_password && employee.status === "ACTIVE") || params.firstLogin === "1" && Boolean(employee?.must_change_password);
  const isOwner = Boolean(activeContext.tenantId && activeContext.employeeId === null && activeContext.role === "ADMINISTRATEUR");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><SettingsClient firstName={auth.user.user_metadata?.first_name ?? ""} email={auth.user.email ?? ""} phone={auth.user.phone ?? ""} mustChangePassword={mustChangePassword} tenantId={activeContext.tenantId ?? ""} isOwner={isOwner} /></DashboardShell>;
}
