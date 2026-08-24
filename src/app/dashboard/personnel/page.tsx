/* Maquette gestionpersonnel: route protégée et écran d’équipe relié à l’API employees. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { PersonnelClient } from "./PersonnelClient";

export const dynamic = "force-dynamic";

export default async function PersonnelPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><PersonnelClient /></DashboardShell>;
}
