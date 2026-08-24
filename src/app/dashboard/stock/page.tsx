/* Maquette gestiondesstocks: route protégée et écran d’inventaire connecté à l’API stock. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { StockClient } from "./StockClient";
import { getAuthorizationContext } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const context = await getAuthorizationContext();
  const { data: employee } = context.employeeId ? await context.supabase.from("employees").select("stock_scope").eq("id", context.employeeId).maybeSingle() : { data: null };
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><StockClient role={context.role ?? ""} stockScope={employee?.stock_scope ?? "BOTH"} /></DashboardShell>;
}
