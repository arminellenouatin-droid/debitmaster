// DebitManager authorization boundary: every protected API must resolve tenant and permission server-side.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { defaultRolePermissions } from "@/lib/staff-permissions";

export async function getAuthorizationContext() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { supabase, user: null, tenantIds: [], allTenantIds: [], role: null, employeeId: null, permissions: new Set<string>(), userType: null, isPlatformAdmin: false, isCommerceStaff: false, isCoutureStaff: false, affiliateId: null };

  const user = authData.user;
  const { data: ownedCompanies, error: ownedError } = await supabase.from("companies").select("id,activity_type").eq("owner_user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(1000);
  if (ownedError) throw new Error("Impossible de vérifier les établissements.");
  const allOwnedTenantIds = (ownedCompanies ?? []).map((company) => company.id);
  const ownedTenantIds = (ownedCompanies ?? []).filter((company) => company.activity_type !== "BOUTIQUE_COMMERCE" && company.activity_type !== "ATELIER_COUTURE").map((company) => company.id);

  const { data: profile } = await supabase.from("profiles").select("tenant_id,role,user_type,status,must_change_password").eq("id", user.id).maybeSingle();
  const isPlatformAdmin = profile?.user_type === "SUPER_ADMIN" && profile.role === "MASTER_ADMIN" && profile.status === "ACTIVE";
  const userType = profile?.user_type ?? null;
  const isCommerceStaff = profile?.role === "COMMERCE_STAFF";
  const isCoutureStaff = profile?.role === "COUTURE_STAFF";
  const { data: affiliate } = userType === "AFFILIATE" ? await supabase.from("platform_affiliates").select("id").eq("user_id", user.id).eq("status", "ACTIVE").maybeSingle() : { data: null };
  const { data: employee } = await supabase.from("employees").select("id,tenant_id,position,status").eq("user_id", user.id).is("deleted_at", null).eq("status", "ACTIVE").maybeSingle();
  const tenantIds = isCommerceStaff || isCoutureStaff ? [] : employee?.tenant_id ? [employee.tenant_id] : ownedTenantIds;
  const allTenantIds = isCommerceStaff || isCoutureStaff ? [] : employee?.tenant_id ? [employee.tenant_id] : allOwnedTenantIds;
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

  return { supabase, user, tenantIds, allTenantIds, role, employeeId: employee?.id ?? null, permissions, userType, isPlatformAdmin, isCommerceStaff, isCoutureStaff, affiliateId: affiliate?.id ?? null, mustChangePassword: Boolean(profile?.must_change_password) };
}

export function can(context: Awaited<ReturnType<typeof getAuthorizationContext>>, permission: string) {
  return Boolean(context.user && context.permissions.has(permission));
}
