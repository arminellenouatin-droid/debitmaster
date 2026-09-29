import { NextResponse } from "next/server";
import { canCommerce, getCommerceContext } from "@/lib/commerce-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? undefined;
    const context = await getCommerceContext(tenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.company || !context.tenantId) return NextResponse.json({ error: "Établissement Commerce non autorisé." }, { status: 403 });
    if (context.accessMode === "BLOCKED") return NextResponse.json({ error: "Cet établissement est suspendu. Contactez le propriétaire." }, { status: 403 });
    if (!canCommerce(context, "dashboard.view")) return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });

    const admin = createSupabaseAdminClient();
    const canSeeStores = canCommerce(context, "stores.view");
    const canSeeTeam = canCommerce(context, "team.view");
    const canSeeAudit = canCommerce(context, "audit.view");
    const [storeResult, employeeResult, roleResult, auditResult] = await Promise.all([
      canSeeStores ? admin.from("commerce_stores").select("id,tenant_id,name,store_type,address,city,status,created_at").eq("tenant_id", context.tenantId).order("created_at", { ascending: true }).limit(100) : Promise.resolve({ data: [], error: null }),
      canSeeTeam ? admin.from("commerce_employees").select("id,status").eq("tenant_id", context.tenantId).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
      canSeeTeam ? admin.from("commerce_roles").select("id,tenant_id,role_key,name,description,is_system,is_active,created_at").eq("tenant_id", context.tenantId).eq("is_active", true).order("is_system", { ascending: false }).order("name").limit(100) : Promise.resolve({ data: [], error: null }),
      canSeeAudit ? admin.from("commerce_audit_events").select("id,actor_user_id,action,entity_type,entity_id,metadata,created_at").eq("tenant_id", context.tenantId).order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
    ]);
    if (storeResult.error || employeeResult.error || roleResult.error || auditResult.error) return NextResponse.json({ error: "Impossible de charger le tableau de bord Commerce." }, { status: 500 });

    const stores = (storeResult.data ?? []).filter((store) => context.isOwner || context.storeIds.includes(store.id));
    const allEmployees = employeeResult.data ?? [];
    let employees = context.isOwner ? allEmployees : [];
    if (!context.isOwner && context.storeIds.length && allEmployees.length) {
      const { data: employeeStoreAssignments, error: assignmentError } = await admin.from("commerce_employee_stores").select("employee_id,store_id").eq("tenant_id", context.tenantId).in("employee_id", allEmployees.map((employee) => employee.id)).in("store_id", context.storeIds).limit(1000);
      if (assignmentError) return NextResponse.json({ error: "Impossible de vérifier les périmètres de l’équipe." }, { status: 500 });
      const visibleEmployeeIds = new Set((employeeStoreAssignments ?? []).map((assignment) => assignment.employee_id));
      employees = allEmployees.filter((employee) => visibleEmployeeIds.has(employee.id));
    }
    const roles = roleResult.data ?? [];
    const cutoff = context.company.subscription_expires_at || context.company.trial_ends_at;
    return NextResponse.json({
      company: { id: context.company.id, name: context.company.name, activityType: context.company.activity_type, country: context.company.country, currency: context.company.currency },
      isOwner: context.isOwner,
      roleNames: context.isOwner ? ["Promoteur / Propriétaire"] : context.roles.map((role) => role.name),
      permissions: [...context.permissions],
      accessMode: context.accessMode,
      subscription: { status: context.company.status, plan: context.company.subscription_plan, trialEndsAt: context.company.trial_ends_at, expiresAt: context.company.subscription_expires_at, cutoff },
      stores,
      employees,
      roles,
      auditEvents: auditResult.data ?? [],
      metrics: { storeCount: stores.length, activeEmployeeCount: employees.filter((employee) => employee.status === "ACTIVE").length, roleCount: roles.length },
    });
  } catch {
    return NextResponse.json({ error: "Service Commerce temporairement indisponible." }, { status: 500 });
  }
}
