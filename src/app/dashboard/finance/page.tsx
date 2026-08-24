/* Maquette tresoreriecomptabilite: route protégée et synthèse financière dérivée des APIs du tenant. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { FinanceClient } from "./FinanceClient";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><FinanceClient /></DashboardShell>;
}
