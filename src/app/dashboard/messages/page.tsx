/* Maquette messagerieinterne: route protégée et conversations reliées à l’API interne du tenant. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { MessagesClient } from "./MessagesClient";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><MessagesClient /></DashboardShell>;
}
