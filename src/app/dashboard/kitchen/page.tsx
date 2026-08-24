/* Maquette fildattentecuisine: route protégée et file d’attente cuisine reliée aux commandes du tenant. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { KitchenClient } from "./KitchenClient";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><KitchenClient /></DashboardShell>;
}
