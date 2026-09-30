import { NextResponse } from "next/server";
import { canCommerce, canWriteCommerce, getCommerceContext } from "@/lib/commerce-auth";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCommerceAuditEvent } from "@/lib/commerce-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneIdentifier, syntheticEmailForPhone } from "@/lib/auth-identifiers";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? undefined;
    const context = await getCommerceContext(tenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.company || !canCommerce(context, "team.view")) return NextResponse.json({ error: "Accès à l’équipe non autorisé." }, { status: 403 });
    const admin = createSupabaseAdminClient();
    const { data: employees, error } = await admin.from("commerce_employees").select("id,tenant_id,first_name,last_name,phone,status,must_change_password,created_at").eq("tenant_id", context.tenantId).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Impossible de charger l’équipe Commerce." }, { status: 500 });
    const ids = (employees ?? []).map((employee) => employee.id);
    const [{ data: assignments }, { data: storeAssignments }] = ids.length ? await Promise.all([
      admin.from("commerce_employee_roles").select("employee_id,role_id").eq("tenant_id", context.tenantId).in("employee_id", ids).limit(500),
      admin.from("commerce_employee_stores").select("employee_id,store_id").eq("tenant_id", context.tenantId).in("employee_id", ids).limit(1000),
    ]) : [{ data: [] }, { data: [] }];
    const roleIds = [...new Set((assignments ?? []).map((row) => row.role_id as string))];
    const storeIds = [...new Set((storeAssignments ?? []).map((row) => row.store_id as string))];
    const [{ data: roles }, { data: stores }] = await Promise.all([
      roleIds.length ? admin.from("commerce_roles").select("id,role_key,name").eq("tenant_id", context.tenantId).in("id", roleIds).limit(100) : Promise.resolve({ data: [] }),
      storeIds.length ? admin.from("commerce_stores").select("id,name").eq("tenant_id", context.tenantId).in("id", storeIds).limit(100) : Promise.resolve({ data: [] }),
    ]);
    const scopedStoreAssignments = (storeAssignments ?? []).filter((item) => context.isOwner || context.storeIds.includes(item.store_id));
    const visibleEmployees = context.isOwner ? employees ?? [] : (employees ?? []).filter((employee) => scopedStoreAssignments.some((item) => item.employee_id === employee.id));
    return NextResponse.json({ employees: visibleEmployees.map((employee) => ({ ...employee, roles: (assignments ?? []).filter((item) => item.employee_id === employee.id).map((item) => roles?.find((role) => role.id === item.role_id)).filter(Boolean), stores: scopedStoreAssignments.filter((item) => item.employee_id === employee.id).map((item) => stores?.find((store) => store.id === item.store_id)).filter(Boolean) })), accessMode: context.accessMode });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const firstName = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 80) : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim().slice(0, 100) : "";
    const phone = typeof body.phone === "string" ? normalizePhoneIdentifier(body.phone) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const roleIds: string[] = Array.isArray(body.roleIds) ? Array.from(new Set<string>(body.roleIds.filter((id: unknown): id is string => typeof id === "string"))) : [];
    const storeIds: string[] = Array.isArray(body.storeIds) ? Array.from(new Set<string>(body.storeIds.filter((id: unknown): id is string => typeof id === "string"))) : [];
    if (firstName.length < 2 || lastName.length < 2 || !phone || password.length < 8 || roleIds.length < 1 || roleIds.length > 8 || storeIds.length < 1 || storeIds.length > 50) return NextResponse.json({ error: "Prénom, nom, téléphone international, mot de passe temporaire (8 caractères minimum), rôles et magasins requis." }, { status: 400 });

    const context = await getCommerceContext(tenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.company || !canCommerce(context, "team.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer les comptes Commerce." }, { status: 403 });
    if (!canWriteCommerce(context)) return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });

    const admin = createSupabaseAdminClient();
    const [{ data: roles }, { data: stores }] = await Promise.all([
      admin.from("commerce_roles").select("id,role_key").eq("tenant_id", context.tenantId).eq("is_active", true).in("id", roleIds).limit(8),
      admin.from("commerce_stores").select("id").eq("tenant_id", context.tenantId).eq("status", "ACTIVE").in("id", storeIds).limit(50),
    ]);
    if ((roles ?? []).length !== roleIds.length || (stores ?? []).length !== storeIds.length) return NextResponse.json({ error: "Un rôle ou un magasin sélectionné n’appartient pas à cet établissement." }, { status: 400 });
    if (!context.isOwner && storeIds.some((id) => !context.storeIds.includes(id))) return NextResponse.json({ error: "Vous ne pouvez gérer que les magasins auxquels vous êtes affecté." }, { status: 403 });
    if (!context.isOwner) {
      const { data: rolePermissions, error: rolePermissionError } = await admin.from("commerce_role_permissions").select("role_id,permission_key").eq("tenant_id", context.tenantId).in("role_id", roleIds).limit(1000);
      if (rolePermissionError) return NextResponse.json({ error: "Impossible de vérifier les droits des rôles." }, { status: 500 });
      if ((rolePermissions ?? []).some((permission) => !context.permissions.has(permission.permission_key))) return NextResponse.json({ error: "Vous ne pouvez pas attribuer des droits supérieurs aux vôtres." }, { status: 403 });
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email: syntheticEmailForPhone(phone), phone, password, email_confirm: true, phone_confirm: true, user_metadata: { first_name: firstName, last_name: lastName, account_type: "COMMERCE_STAFF" } });
    if (authError || !authData.user) return NextResponse.json({ error: "Impossible de créer ce compte. Vérifiez que le téléphone n’est pas déjà utilisé." }, { status: 409 });
    const userId = authData.user.id;
    const { error: profileError } = await admin.from("profiles").upsert({ id: userId, tenant_id: context.tenantId, first_name: firstName, last_name: lastName, phone, user_type: "TENANT_STAFF", role: "COMMERCE_STAFF", status: "ACTIVE", must_change_password: true }, { onConflict: "id" });
    const { data: employee, error: employeeError } = profileError ? { data: null, error: profileError } : await admin.from("commerce_employees").insert({ tenant_id: context.tenantId, user_id: userId, first_name: firstName, last_name: lastName, phone, status: "ACTIVE", must_change_password: true, created_by: context.user.id }).select("id,tenant_id,first_name,last_name,phone,status,must_change_password,created_at").single();
    if (!employee || employeeError) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Impossible d’enregistrer le compte dans cet établissement." }, { status: 400 });
    }
    const [{ error: roleError }, { error: storeError }] = await Promise.all([
      admin.from("commerce_employee_roles").insert(roleIds.map((role_id: string) => ({ tenant_id: context.tenantId, employee_id: employee.id, role_id, assigned_by: context.user!.id }))),
      admin.from("commerce_employee_stores").insert(storeIds.map((store_id: string) => ({ tenant_id: context.tenantId, employee_id: employee.id, store_id, assigned_by: context.user!.id }))),
    ]);
    if (roleError || storeError) {
      await admin.from("commerce_employee_roles").delete().eq("employee_id", employee.id);
      await admin.from("commerce_employee_stores").delete().eq("employee_id", employee.id);
      await admin.from("commerce_employees").delete().eq("id", employee.id);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Impossible d’attribuer les rôles et magasins au compte." }, { status: 400 });
    }
    const audited = await writeCommerceAuditEvent({ tenantId: context.tenantId!, actorUserId: context.user.id, action: "EMPLOYEE_CREATED", entityType: "EMPLOYEE", entityId: employee.id, metadata: { roleIds, storeIds } });
    if (!audited) {
      await admin.from("commerce_employee_roles").delete().eq("employee_id", employee.id);
      await admin.from("commerce_employee_stores").delete().eq("employee_id", employee.id);
      await admin.from("commerce_employees").delete().eq("id", employee.id);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Le compte n’a pas été enregistré dans le journal d’audit." }, { status: 500 });
    }
    return NextResponse.json({ employee }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const status = body.status === "INACTIVE" ? "INACTIVE" : body.status === "ACTIVE" ? "ACTIVE" : "";
    if (!employeeId || !status) return NextResponse.json({ error: "Compte et statut valides requis." }, { status: 400 });
    const context = await getCommerceContext(tenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.company || !canCommerce(context, "team.manage")) return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    if (!canWriteCommerce(context)) return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    const admin = createSupabaseAdminClient();
    const { data: previous } = await admin.from("commerce_employees").select("status").eq("id", employeeId).eq("tenant_id", context.tenantId).maybeSingle();
    if (!previous) return NextResponse.json({ error: "Compte Commerce introuvable." }, { status: 404 });
    if (!context.isOwner) {
      const { data: assignments, error: scopeError } = await admin.from("commerce_employee_stores").select("store_id").eq("tenant_id", context.tenantId).eq("employee_id", employeeId).limit(100);
      if (scopeError) return NextResponse.json({ error: "Impossible de vérifier les magasins autorisés." }, { status: 500 });
      if (!(assignments ?? []).some((item) => context.storeIds.includes(item.store_id))) return NextResponse.json({ error: "Ce compte n’appartient pas à vos magasins autorisés." }, { status: 403 });
    }
    const { data: employee, error } = await admin.from("commerce_employees").update({ status, updated_at: new Date().toISOString() }).eq("id", employeeId).eq("tenant_id", context.tenantId).select("id,status").single();
    if (error || !employee) return NextResponse.json({ error: "Impossible de modifier le compte." }, { status: 400 });
    const audited = await writeCommerceAuditEvent({ tenantId: context.tenantId!, actorUserId: context.user.id, action: status === "ACTIVE" ? "EMPLOYEE_REACTIVATED" : "EMPLOYEE_DEACTIVATED", entityType: "EMPLOYEE", entityId: employee.id, metadata: { previousStatus: previous.status, newStatus: status } });
    if (!audited) {
      await admin.from("commerce_employees").update({ status: previous.status, updated_at: new Date().toISOString() }).eq("id", employeeId).eq("tenant_id", context.tenantId);
      return NextResponse.json({ error: "La modification du compte n’a pas été enregistrée dans le journal d’audit." }, { status: 500 });
    }
    return NextResponse.json({ employee });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
