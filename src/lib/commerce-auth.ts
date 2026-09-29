import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { commercePermissionCatalog } from "@/lib/commerce-permissions";
import { ACTIVE_TENANT_COOKIE } from "@/lib/active-tenant";

export type CommerceAccessMode = "ACTIVE" | "GRACE" | "READ_ONLY" | "BLOCKED";
type CommerceCompany = {
  id: string;
  name: string;
  activity_type: string;
  country: string;
  currency: string;
  status: string;
  trial_ends_at: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  owner_user_id: string | null;
};
type CommerceEmployee = { id: string; tenant_id: string; user_id: string; first_name: string; last_name: string; phone: string; status: string; must_change_password: boolean };
type CommerceRole = { id: string; role_key: string; name: string };

export type CommerceContext = {
  user: User | null;
  tenantId: string | null;
  company: CommerceCompany | null;
  isOwner: boolean;
  employee: CommerceEmployee | null;
  roles: CommerceRole[];
  storeIds: string[];
  permissions: Set<string>;
  accessMode: CommerceAccessMode;
};

const emptyContext = (): CommerceContext => ({ user: null, tenantId: null, company: null, isOwner: false, employee: null, roles: [], storeIds: [], permissions: new Set(), accessMode: "BLOCKED" });
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function commerceAccessMode(company: Pick<CommerceCompany, "status" | "trial_ends_at" | "subscription_expires_at">, now = Date.now()): CommerceAccessMode {
  const status = String(company.status ?? "").toUpperCase();
  if (["SUSPENDED", "CANCELLED"].includes(status)) return "BLOCKED";
  if (status === "EXPIRED") return "READ_ONLY";
  const cutoffValue = company.subscription_expires_at || company.trial_ends_at;
  if (!cutoffValue) return status === "EXPIRED" ? "READ_ONLY" : "ACTIVE";
  const cutoff = new Date(cutoffValue).getTime();
  if (!Number.isFinite(cutoff) || now <= cutoff) return "ACTIVE";
  if (now <= cutoff + 5 * 24 * 60 * 60 * 1000) return "GRACE";
  return "READ_ONLY";
}

export async function getCommerceContext(requestedTenantId?: string): Promise<CommerceContext> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return emptyContext();

  const admin = createSupabaseAdminClient();
  const cookiesStore = await cookies();
  const candidateIds = [requestedTenantId, cookiesStore.get(ACTIVE_TENANT_COOKIE)?.value].filter((value): value is string => Boolean(value && isUuid(value)));
  const companyColumns = "id,name,activity_type,country,currency,status,trial_ends_at,subscription_plan,subscription_expires_at,owner_user_id";
  const findCompany = async (tenantId: string) => {
    const { data } = await admin.from("companies").select(companyColumns).eq("id", tenantId).eq("activity_type", "BOUTIQUE_COMMERCE").is("deleted_at", null).maybeSingle();
    return (data as CommerceCompany | null) ?? null;
  };
  let company: CommerceCompany | null = null;
  let employee: CommerceEmployee | null = null;

  for (const tenantId of Array.from(new Set(candidateIds))) {
    company = await findCompany(tenantId);
    if (company) break;
  }

  if (!company && !requestedTenantId) {
    const { data } = await admin.from("companies").select(companyColumns).eq("owner_user_id", auth.user.id).eq("activity_type", "BOUTIQUE_COMMERCE").is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) company = data as CommerceCompany;
    if (!company) {
      const { data: memberships } = await admin.from("commerce_employees").select("id,tenant_id,user_id,first_name,last_name,phone,status,must_change_password").eq("user_id", auth.user.id).eq("status", "ACTIVE").order("created_at", { ascending: false }).limit(20);
      for (const membership of memberships ?? []) {
        const memberCompany = await findCompany(membership.tenant_id as string);
        if (memberCompany) { company = memberCompany; employee = membership as CommerceEmployee; break; }
      }
    }
  }
  if (!company) return { ...emptyContext(), user: auth.user };

  let isOwner = company.owner_user_id === auth.user.id;
  if (!isOwner && !employee) {
    const { data } = await admin.from("commerce_employees").select("id,tenant_id,user_id,first_name,last_name,phone,status,must_change_password").eq("tenant_id", company.id).eq("user_id", auth.user.id).eq("status", "ACTIVE").maybeSingle();
    employee = (data as CommerceEmployee | null) ?? null;
  }
  if (!isOwner && !employee && !requestedTenantId) {
    const { data: owned } = await admin.from("companies").select(companyColumns).eq("owner_user_id", auth.user.id).eq("activity_type", "BOUTIQUE_COMMERCE").is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (owned) { company = owned as CommerceCompany; isOwner = true; }
    else {
      const { data: memberships } = await admin.from("commerce_employees").select("id,tenant_id,user_id,first_name,last_name,phone,status,must_change_password").eq("user_id", auth.user.id).eq("status", "ACTIVE").order("created_at", { ascending: false }).limit(20);
      for (const membership of memberships ?? []) {
        const memberCompany = await findCompany(membership.tenant_id as string);
        if (memberCompany) { company = memberCompany; employee = membership as CommerceEmployee; break; }
      }
    }
  }
  if (!isOwner && !employee) return { ...emptyContext(), user: auth.user };

  let roles: CommerceRole[] = [];
  let storeIds: string[] = [];
  const permissions = new Set<string>();
  if (isOwner) {
    for (const permission of commercePermissionCatalog) permissions.add(permission.key);
  } else if (employee) {
    const [{ data: assignments }, { data: storeAssignments }] = await Promise.all([
      admin.from("commerce_employee_roles").select("role_id").eq("tenant_id", company.id).eq("employee_id", employee.id).limit(20),
      admin.from("commerce_employee_stores").select("store_id").eq("tenant_id", company.id).eq("employee_id", employee.id).limit(100),
    ]);
    const roleIds = [...new Set((assignments ?? []).map((row) => row.role_id as string))];
    storeIds = [...new Set((storeAssignments ?? []).map((row) => row.store_id as string))];
    if (roleIds.length) {
      const [{ data: roleRows }, { data: permissionRows }] = await Promise.all([
        admin.from("commerce_roles").select("id,role_key,name").eq("tenant_id", company.id).in("id", roleIds).eq("is_active", true).limit(20),
        admin.from("commerce_role_permissions").select("permission_key").eq("tenant_id", company.id).in("role_id", roleIds).limit(200),
      ]);
      roles = (roleRows ?? []) as CommerceRole[];
      for (const row of permissionRows ?? []) permissions.add(row.permission_key as string);
    }
  }

  const accessMode = employee?.must_change_password ? "BLOCKED" : commerceAccessMode(company);
  return { user: auth.user, tenantId: company.id, company, isOwner, employee, roles, storeIds, permissions, accessMode };
}

export function canCommerce(context: CommerceContext, permission: string) {
  return Boolean(context.user && context.company && context.accessMode !== "BLOCKED" && (context.isOwner || context.permissions.has(permission)));
}

export function canWriteCommerce(context: CommerceContext) {
  return Boolean(context.user && context.company && context.accessMode === "ACTIVE");
}
