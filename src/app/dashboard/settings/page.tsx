/* Maquette profilparametre: route protégée et écran de réglages avec données de session minimisées. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><SettingsClient firstName={auth.user.user_metadata?.first_name ?? ""} email={auth.user.email ?? ""} /></DashboardShell>;
}
