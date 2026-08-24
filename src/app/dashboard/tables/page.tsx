/* Maquette plandesalle: route protégée, navigation persistante et plan de salle relié aux commandes du tenant. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { TablesClient } from "./TablesClient";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><TablesClient /></DashboardShell>;
}
