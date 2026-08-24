// DebitManager authorization boundary: every protected API must resolve tenant and permission server-side.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { defaultRolePermissions } from "@/lib/staff-permissions";

export async function getAuthorizationContext() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { supabase, user: null, tenantIds: [], role: null, employeeId: null, permissions: new Set<string>() };

  const user = authData.user;
  const { data: ownedCompanies, error: ownedError } = await supabase.from("companies").select("id").eq("owner_user_id", user.id).is("deleted_at", null).limit(50);
  if (ownedError) throw new Error("Impossible de vérifier les établissements.");
  const ownedTenantIds = (ownedCompanies ?? []).map((company) => company.id);

  const { data: profile } = await supabase.from("profiles").select("tenant_id,role").eq("id", user.id).maybeSingle();
  const { data: employee } = await supabase.from("employees").select("id,tenant_id,position,status").eq("user_id", user.id).is("deleted_at", null).eq("status", "ACTIVE").maybeSingle();
  const tenantIds = employee?.tenant_id ? [employee.tenant_id] : ownedTenantIds;
  const role = employee?.position ?? profile?.role ?? (ownedTenantIds.length ? "ADMINISTRATEUR" : "");
  const permissions = new Set(defaultRolePermissions[role] ?? []);

  if (employee?.id) {
    const { data: overrides } = await supabase.from("employee_permissions").select("permission_key,enabled").eq("employee_id", employee.id).eq("tenant_id", employee.tenant_id).limit(100);
    for (const override of overrides ?? []) {
      if (override.enabled) permissions.add(override.permission_key);
      else permissions.delete(override.permission_key);
    }
  } else if (ownedTenantIds.length) {
    for (const permission of defaultRolePermissions.ADMINISTRATEUR) permissions.add(permission);
  }

  return { supabase, user, tenantIds, role, employeeId: employee?.id ?? null, permissions };
}

export function can(context: Awaited<ReturnType<typeof getAuthorizationContext>>, permission: string) {
  return Boolean(context.user && context.permissions.has(permission));
}
