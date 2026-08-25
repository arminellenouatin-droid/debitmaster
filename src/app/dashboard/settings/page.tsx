// DebitManager profile settings: account security only; subscription actions live in the owner shell controls.
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

type SettingsPageProps = { searchParams: Promise<{ firstLogin?: string }> };

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const { data: employee } = await supabase.from("employees").select("must_change_password,status").eq("user_id", auth.user.id).is("deleted_at", null).maybeSingle();
  const params = await searchParams;
  const mustChangePassword = Boolean(employee?.must_change_password && employee.status === "ACTIVE") || params.firstLogin === "1" && Boolean(employee?.must_change_password);
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><SettingsClient firstName={auth.user.user_metadata?.first_name ?? ""} email={auth.user.email ?? ""} phone={auth.user.phone ?? ""} mustChangePassword={mustChangePassword} /></DashboardShell>;
}
