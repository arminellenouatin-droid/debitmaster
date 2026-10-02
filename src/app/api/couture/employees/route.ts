import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneIdentifier, syntheticEmailForPhone } from "@/lib/auth-identifiers";

const validCrafts = ["COUPEUR", "COUTURIER", "BRODEUR_MAIN", "BRODEUR_MACHINE", "FINISSEUR"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "team.view");

    const admin = createSupabaseAdminClient();
    const { data: employees, error } = await admin
      .from("couture_employees")
      .select("id,tenant_id,first_name,last_name,phone,crafts,status,must_change_password,created_at")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: "Impossible de charger l’équipe Couture." }, { status: 500 });
    }

    const employeeIds = (employees ?? []).map((emp) => emp.id);

    const [{ data: roleAssignments }, { data: siteAssignments }] = employeeIds.length
      ? await Promise.all([
          admin.from("couture_employee_roles").select("employee_id,role_id").eq("tenant_id", context.tenantId).in("employee_id", employeeIds).limit(500),
          admin.from("couture_employee_sites").select("employee_id,site_id").eq("tenant_id", context.tenantId).in("employee_id", employeeIds).limit(1000),
        ])
      : [{ data: [] }, { data: [] }];

    const roleIds = [...new Set((roleAssignments ?? []).map((row) => row.role_id as string))];
    const siteIds = [...new Set((siteAssignments ?? []).map((row) => row.site_id as string))];

    const [{ data: roles }, { data: sites }] = await Promise.all([
      roleIds.length ? admin.from("couture_roles").select("id,role_key,name").eq("tenant_id", context.tenantId).in("id", roleIds).limit(100) : Promise.resolve({ data: [] }),
      siteIds.length ? admin.from("couture_sites").select("id,name,site_type,city,currency").eq("tenant_id", context.tenantId).in("id", siteIds).limit(100) : Promise.resolve({ data: [] }),
    ]);

    const formattedEmployees = (employees ?? []).map((employee) => ({
      ...employee,
      roles: (roleAssignments ?? []).filter((item) => item.employee_id === employee.id).map((item) => roles?.find((r) => r.id === item.role_id)).filter(Boolean),
      sites: (siteAssignments ?? []).filter((item) => item.employee_id === employee.id).map((item) => sites?.find((s) => s.id === item.site_id)).filter(Boolean),
    }));

    return NextResponse.json({ employees: formattedEmployees, accessMode: context.accessMode });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "team.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const firstName = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 80) : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim().slice(0, 100) : "";
    const phone = typeof body.phone === "string" ? normalizePhoneIdentifier(body.phone) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const roleIds: string[] = Array.isArray(body.roleIds) ? Array.from(new Set<string>(body.roleIds.filter((id: unknown): id is string => typeof id === "string"))) : [];
    const siteIds: string[] = Array.isArray(body.siteIds) ? Array.from(new Set<string>(body.siteIds.filter((id: unknown): id is string => typeof id === "string"))) : [];
    const crafts: string[] = Array.isArray(body.crafts) ? Array.from(new Set<string>(body.crafts.filter((c: unknown): c is string => typeof c === "string" && validCrafts.includes(c as any)))) : [];

    if (firstName.length < 2 || lastName.length < 2 || !phone || password.length < 8 || roleIds.length < 1 || roleIds.length > 8) {
      return NextResponse.json({
        error: "Prénom, nom, téléphone international, mot de passe temporaire (8 caractères minimum) et au moins un rôle sont requis.",
      }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const [{ data: roles }, { data: sites }] = await Promise.all([
      admin.from("couture_roles").select("id,role_key").eq("tenant_id", context.tenantId).eq("is_active", true).in("id", roleIds).limit(8),
      siteIds.length
        ? admin.from("couture_sites").select("id").eq("tenant_id", context.tenantId).eq("status", "ACTIVE").in("id", siteIds).limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    if ((roles ?? []).length !== roleIds.length || (siteIds.length > 0 && (sites ?? []).length !== siteIds.length)) {
      return NextResponse.json({ error: "Un rôle ou un site sélectionné n’appartient pas à cet établissement." }, { status: 400 });
    }

    // Role privilege escalation check: non-owners cannot grant permissions they do not possess
    if (!context.isOwner) {
      const { data: rolePermissions, error: permError } = await admin
        .from("couture_role_permissions")
        .select("role_id,permission_key")
        .eq("tenant_id", context.tenantId)
        .in("role_id", roleIds)
        .limit(1000);

      if (permError) return NextResponse.json({ error: "Impossible de vérifier les droits des rôles." }, { status: 500 });
      if ((rolePermissions ?? []).some((perm) => !context.permissions.has(perm.permission_key))) {
        return NextResponse.json({ error: "Vous ne pouvez pas attribuer des droits supérieurs aux vôtres." }, { status: 403 });
      }
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: syntheticEmailForPhone(phone),
      phone,
      password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, account_type: "COUTURE_STAFF" },
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Impossible de créer ce compte. Vérifiez que le téléphone n’est pas déjà utilisé." }, { status: 409 });
    }

    const userId = authData.user.id;
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        tenant_id: context.tenantId,
        first_name: firstName,
        last_name: lastName,
        phone,
        user_type: "TENANT_STAFF",
        role: "COUTURE_STAFF",
        status: "ACTIVE",
        must_change_password: true,
      },
      { onConflict: "id" }
    );

    const { data: employee, error: employeeError } = profileError
      ? { data: null, error: profileError }
      : await admin
          .from("couture_employees")
          .insert({
            tenant_id: context.tenantId,
            user_id: userId,
            first_name: firstName,
            last_name: lastName,
            phone,
            crafts,
            status: "ACTIVE",
            must_change_password: true,
            created_by: context.user.id,
          })
          .select("id,tenant_id,first_name,last_name,phone,crafts,status,must_change_password,created_at")
          .single();

    if (!employee || employeeError) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Impossible d’enregistrer le collaborateur dans cet établissement." }, { status: 400 });
    }

    const { error: roleError } = await admin.from("couture_employee_roles").insert(
      roleIds.map((role_id) => ({ tenant_id: context.tenantId, employee_id: employee.id, role_id, assigned_by: context.user!.id }))
    );

    let siteError = null;
    if (siteIds.length > 0) {
      const siteResult = await admin.from("couture_employee_sites").insert(
        siteIds.map((site_id) => ({ tenant_id: context.tenantId, employee_id: employee.id, site_id, assigned_by: context.user!.id }))
      );
      siteError = siteResult.error;
    }

    if (roleError || siteError) {
      await admin.from("couture_employee_roles").delete().eq("employee_id", employee.id);
      await admin.from("couture_employee_sites").delete().eq("employee_id", employee.id);
      await admin.from("couture_employees").delete().eq("id", employee.id);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Impossible d’attribuer les rôles et sites au collaborateur." }, { status: 400 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId!,
      actorUserId: context.user.id,
      action: "EMPLOYEE_CREATED",
      entityType: "EMPLOYEE",
      entityId: employee.id,
      metadata: { roleIds, siteIds, crafts },
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
