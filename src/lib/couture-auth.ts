import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { couturePermissionCatalog, type CouturePermission, coutureAccessMode, type CoutureAccessMode } from "@/lib/couture-permissions";
import { ACTIVE_TENANT_COOKIE } from "@/lib/active-tenant";

export { coutureAccessMode, type CoutureAccessMode };

export type CoutureCompany = {
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

export type CoutureEmployee = {
  id: string;
  tenant_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  crafts: string[];
  status: string;
  must_change_password: boolean;
};

export type CoutureRole = {
  id: string;
  role_key: string;
  name: string;
};

export type CoutureSite = {
  id: string;
  tenant_id: string;
  name: string;
  site_type: "BOUTIQUE" | "ATELIER";
  country: string;
  city: string | null;
  address: string | null;
  currency: string;
  phone: string | null;
  photo_url: string | null;
  status: string;
};

export type CoutureContext = {
  user: User | null;
  tenantId: string | null;
  company: CoutureCompany | null;
  isOwner: boolean;
  employee: CoutureEmployee | null;
  roles: CoutureRole[];
  siteIds: string[];
  sites: CoutureSite[];
  permissions: Set<string>;
  accessMode: CoutureAccessMode;
  crafts: string[];
};

const emptyContext = (): CoutureContext => ({
  user: null,
  tenantId: null,
  company: null,
  isOwner: false,
  employee: null,
  roles: [],
  siteIds: [],
  sites: [],
  permissions: new Set(),
  accessMode: "BLOCKED",
  crafts: [],
});

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);


export async function getCoutureContext(requestedTenantId?: string): Promise<CoutureContext> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return emptyContext();

  const admin = createSupabaseAdminClient();
  const cookiesStore = await cookies();
  const candidateIds = [requestedTenantId, cookiesStore.get(ACTIVE_TENANT_COOKIE)?.value].filter(
    (value): value is string => Boolean(value && isUuid(value))
  );

  const companyColumns =
    "id,name,activity_type,country,currency,status,trial_ends_at,subscription_plan,subscription_expires_at,owner_user_id";

  const findCompany = async (tenantId: string) => {
    const { data } = await admin
      .from("companies")
      .select(companyColumns)
      .eq("id", tenantId)
      .eq("activity_type", "ATELIER_COUTURE")
      .is("deleted_at", null)
      .maybeSingle();
    return (data as CoutureCompany | null) ?? null;
  };

  let company: CoutureCompany | null = null;
  let employee: CoutureEmployee | null = null;

  for (const tenantId of Array.from(new Set(candidateIds))) {
    company = await findCompany(tenantId);
    if (company) break;
  }

  if (!company && !requestedTenantId) {
    const { data } = await admin
      .from("companies")
      .select(companyColumns)
      .eq("owner_user_id", auth.user.id)
      .eq("activity_type", "ATELIER_COUTURE")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) company = data as CoutureCompany;

    if (!company) {
      const { data: memberships } = await admin
        .from("couture_employees")
        .select("id,tenant_id,user_id,first_name,last_name,phone,crafts,status,must_change_password")
        .eq("user_id", auth.user.id)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .limit(20);

      for (const membership of memberships ?? []) {
        const memberCompany = await findCompany(membership.tenant_id as string);
        if (memberCompany) {
          company = memberCompany;
          employee = membership as CoutureEmployee;
          break;
        }
      }
    }
  }

  if (!company) return { ...emptyContext(), user: auth.user };

  let isOwner = company.owner_user_id === auth.user.id;
  if (!isOwner && !employee) {
    const { data } = await admin
      .from("couture_employees")
      .select("id,tenant_id,user_id,first_name,last_name,phone,crafts,status,must_change_password")
      .eq("tenant_id", company.id)
      .eq("user_id", auth.user.id)
      .eq("status", "ACTIVE")
      .maybeSingle();
    employee = (data as CoutureEmployee | null) ?? null;
  }

  if (!isOwner && !employee && !requestedTenantId) {
    const { data: owned } = await admin
      .from("companies")
      .select(companyColumns)
      .eq("owner_user_id", auth.user.id)
      .eq("activity_type", "ATELIER_COUTURE")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (owned) {
      company = owned as CoutureCompany;
      isOwner = true;
    } else {
      const { data: memberships } = await admin
        .from("couture_employees")
        .select("id,tenant_id,user_id,first_name,last_name,phone,crafts,status,must_change_password")
        .eq("user_id", auth.user.id)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .limit(20);

      for (const membership of memberships ?? []) {
        const memberCompany = await findCompany(membership.tenant_id as string);
        if (memberCompany) {
          company = memberCompany;
          employee = membership as CoutureEmployee;
          break;
        }
      }
    }
  }

  if (!isOwner && !employee) {
    return { ...emptyContext(), user: auth.user, tenantId: company.id, company, accessMode: "BLOCKED" };
  }

  const accessMode = coutureAccessMode(company);
  if (accessMode === "BLOCKED") {
    return { ...emptyContext(), user: auth.user, tenantId: company.id, company, isOwner, employee, accessMode };
  }

  let roles: CoutureRole[] = [];
  const permissions = new Set<string>();
  let siteIds: string[] = [];
  let sites: CoutureSite[] = [];

  const { data: allSitesData } = await admin
    .from("couture_sites")
    .select("id,tenant_id,name,site_type,country,city,address,currency,phone,photo_url,status")
    .eq("tenant_id", company.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const allSites = (allSitesData as CoutureSite[] | null) ?? [];

  if (isOwner) {
    for (const permission of couturePermissionCatalog) {
      permissions.add(permission.key);
    }
    siteIds = allSites.map((site) => site.id);
    sites = allSites;
    roles = [{ id: "owner", role_key: "PROMOTEUR", name: "Promoteur / Propriétaire" }];
  } else if (employee) {
    const { data: employeeRoles } = await admin
      .from("couture_employee_roles")
      .select("role_id,couture_roles(id,role_key,name)")
      .eq("tenant_id", company.id)
      .eq("employee_id", employee.id);

    roles = (employeeRoles ?? [])
      .map((entry: { couture_roles: CoutureRole[] }) => entry.couture_roles[0] ?? null)
      .filter((role): role is CoutureRole => Boolean(role?.id));

    const roleIds = roles.map((role) => role.id);
    if (roleIds.length > 0) {
      const { data: permissionsData } = await admin
        .from("couture_role_permissions")
        .select("permission_key")
        .eq("tenant_id", company.id)
        .in("role_id", roleIds);

      for (const item of permissionsData ?? []) {
        if (typeof item.permission_key === "string") permissions.add(item.permission_key);
      }
    }

    const { data: assignedSites } = await admin
      .from("couture_employee_sites")
      .select("site_id")
      .eq("tenant_id", company.id)
      .eq("employee_id", employee.id);

    const assignedSiteIds = new Set((assignedSites ?? []).map((site: { site_id: string }) => site.site_id));
    if (assignedSiteIds.size === 0) {
      // If no explicit site assigned, can access all active sites for their role scope
      siteIds = allSites.map((site) => site.id);
      sites = allSites;
    } else {
      siteIds = allSites.filter((site) => assignedSiteIds.has(site.id)).map((site) => site.id);
      sites = allSites.filter((site) => assignedSiteIds.has(site.id));
    }
  }

  return {
    user: auth.user,
    tenantId: company.id,
    company,
    isOwner,
    employee,
    roles,
    siteIds,
    sites,
    permissions,
    accessMode,
    crafts: employee?.crafts ?? [],
  };
}

export function canCouture(
  context: CoutureContext,
  permission: CouturePermission,
  siteId?: string
): boolean {
  if (!context.user || !context.tenantId || context.accessMode === "BLOCKED") return false;
  if (!context.permissions.has(permission)) return false;
  if (siteId && !context.isOwner && !context.siteIds.includes(siteId)) return false;
  return true;
}

export function assertCouturePermission(
  context: CoutureContext,
  permission: CouturePermission,
  siteId?: string
): void {
  if (!canCouture(context, permission, siteId)) {
    throw new Error(`Accès refusé : permission couture « ${permission} » requise.`);
  }
}
