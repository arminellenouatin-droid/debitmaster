// DebitManager context: the selected establishment is a server-validated tenant, never a client-only label.
import { cookies } from "next/headers";
import { getAuthorizationContext } from "@/lib/authorization";

export const ACTIVE_TENANT_COOKIE = "debitmanager_active_tenant";

type Company = {
  id: string;
  name: string;
  activity_type: string;
  country: string;
  currency: string;
  language: string;
  status: string;
  trial_ends_at: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
};

export async function getActiveTenantContext() {
  const context = await getAuthorizationContext();
  if (!context.user || !context.tenantIds.length) {
    return { ...context, tenantId: null, company: null as Company | null };
  }

  const cookieStore = await cookies();
  const requestedTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value ?? "";
  const tenantId = context.tenantIds.includes(requestedTenantId) ? requestedTenantId : context.tenantIds[0];
  const { data: company, error } = await context.supabase
    .from("companies")
    .select("id,name,activity_type,country,currency,language,status,trial_ends_at,subscription_plan,subscription_expires_at")
    .eq("id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error("Impossible de charger l’établissement actif.");
  return { ...context, tenantId, company: company as Company | null };
}
