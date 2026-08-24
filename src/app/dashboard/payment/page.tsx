/* Maquette ecranapiement: route protégée et écran d’encaissement intégré au shell DebitManager. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { PaymentClient } from "./PaymentClient";

export const dynamic = "force-dynamic";

export default async function PaymentPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><PaymentClient /></DashboardShell>;
}
