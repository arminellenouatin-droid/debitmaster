/* Maquette gestiondesstocks: route protégée et écran d’inventaire connecté à l’API stock. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { StockClient } from "./StockClient";
import { OwnerStockClient } from "./OwnerStockClient";
import { MagasinierClient } from "../MagasinierClient";
import { getAuthorizationContext } from "@/lib/authorization";
import { getActiveTenantContext } from "@/lib/active-tenant";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const context = await getAuthorizationContext();
  const active = await getActiveTenantContext();
  const { data: employee } = context.employeeId ? await context.supabase.from("employees").select("stock_scope").eq("id", context.employeeId).maybeSingle() : { data: null };
  const firstName = auth.user.user_metadata?.first_name ?? "gérant";
  if (context.role === "MAGASINIER") return <DashboardShell firstName={firstName}><MagasinierClient stockScope={employee?.stock_scope ?? "BOTH"} firstName={firstName} companyName={"Établissement actif"} /></DashboardShell>;
  if ((context.role === "ADMINISTRATEUR" || context.role === "SUPERVISEUR") && active.company?.activity_type === "POWER") return <DashboardShell firstName={firstName}><OwnerStockClient companyName={active.company?.name ?? "Établissement actif"} /></DashboardShell>;
  return <DashboardShell firstName={firstName}><StockClient role={context.role ?? ""} stockScope={employee?.stock_scope ?? "BOTH"} /></DashboardShell>;
}
