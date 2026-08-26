// DebitManager staff API: owners create active staff accounts; establishment-code requests require owner approval.
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { normalizePhoneIdentifier, syntheticEmailForPhone } from "@/lib/auth-identifiers";

const positions = [
  "SERVEUR",
  "SUPERVISEUR",
  "MAGASINIER",
  "GERANT",
  "BARMAN",
  "SECRETAIRE",
  "COMPTABLE",
  "APPROVISIONNEMENT",
  "CUISINIER",
  "CHEF_CUISINE",
  "SECURITE",
  "GYM",
  "AUBERGE",
  "LAVAGE",
  "WIFI",
  "GERANT_ADJOINT",
  "CAISSIER",
  "ADMINISTRATEUR",
] as const;

function normalizePhone(value: string) { return normalizePhoneIdentifier(value); }

function isOwner(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string) {
  return Boolean(context.user && !context.employeeId && context.tenantIds.includes(tenantId));
}

async function isPowerTenant(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string) {
  const { data } = await context.supabase.from("companies").select("id").eq("id", tenantId).eq("activity_type", "POWER").is("deleted_at", null).maybeSingle();
  return Boolean(data);
}

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "team.view") && !isOwner(context, tenantId || context.tenantIds[0] || "")) return NextResponse.json({ error: "Permission insuffisante pour consulter l’équipe." }, { status: 403 });
    if (tenantId && !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const resolvedTenantIds = tenantId ? [tenantId] : context.tenantIds;
    if (!resolvedTenantIds.length) return NextResponse.json({ employees: [], pendingRequests: [], positions });
    const query = context.supabase.from("employees").select("id,tenant_id,user_id,first_name,last_name,phone,position,status,must_change_password,approved_at,created_at,salary_amount,salary_currency,salary_frequency").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
    const { data, error } = await query.in("tenant_id", resolvedTenantIds);
    if (error) return NextResponse.json({ error: "Impossible de charger l’équipe." }, { status: 500 });
    const pendingRequests = isOwner(context, resolvedTenantIds[0])
      ? (await context.supabase.from("employee_access_requests").select("id,tenant_id,user_id,phone,first_name,last_name,position,status,requested_at").in("tenant_id", resolvedTenantIds).eq("status", "PENDING").order("requested_at", { ascending: false }).limit(100)).data ?? []
      : [];
    return NextResponse.json({ employees: data ?? [], pendingRequests, positions });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const position = typeof body.position === "string" ? body.position : "";
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const mustChangePassword = body.mustChangePassword !== false;
    if (!tenantId || firstName.length < 2 || lastName.length < 2 || !phone || password.length < 8 || !positions.includes(position as (typeof positions)[number])) return NextResponse.json({ error: "Prénom, nom, téléphone international, rôle et mot de passe initial valides requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const allowedManager = isOwner(context, tenantId) || (context.role === "SUPERVISEUR" && await isPowerTenant(context, tenantId) && can(context, "team.manage"));
    if (!allowedManager) return NextResponse.json({ error: "Seul le propriétaire ou le superviseur Power autorisé peut créer directement un compte équipe." }, { status: 403 });
    if (!mustChangePassword && !await isPowerTenant(context, tenantId)) return NextResponse.json({ error: "Le mot de passe initial sans changement obligatoire est réservé aux essais Power." }, { status: 403 });

    const admin = createSupabaseAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email: syntheticEmailForPhone(phone), phone, password, email_confirm: true, phone_confirm: true, user_metadata: { first_name: firstName, last_name: lastName, account_type: "STAFF" } });
    if (authError || !authData.user) return NextResponse.json({ error: "Impossible de créer le compte téléphone. Vérifiez que ce numéro n’est pas déjà utilisé." }, { status: 400 });

    const profile = await admin.from("profiles").upsert({ id: authData.user.id, tenant_id: tenantId, first_name: firstName, last_name: lastName, phone, user_type: "TENANT_STAFF", role: position, status: "ACTIVE", must_change_password: mustChangePassword }).select("id,tenant_id,first_name,last_name,phone,role,status,must_change_password").single();
    const employee = await admin.from("employees").insert({ tenant_id: tenantId, user_id: authData.user.id, first_name: firstName, last_name: lastName, phone, position, status: "ACTIVE", must_change_password: mustChangePassword, approved_at: new Date().toISOString(), approved_by: context.user.id, created_by: context.user.id }).select("id,tenant_id,user_id,first_name,last_name,phone,position,status,must_change_password,approved_at,created_at,salary_amount,salary_currency,salary_frequency").single();
    if (profile.error || employee.error) {
      await admin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Impossible d’enregistrer le membre dans cet établissement." }, { status: 400 });
    }
    return NextResponse.json({ employee: employee.data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const salaryEmployeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const salaryTenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    if (salaryEmployeeId && salaryTenantId && (body.salaryAmount !== undefined || body.salaryFrequency !== undefined)) {
      const context = await getAuthorizationContext();
      if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
      const allowedManager = isOwner(context, salaryTenantId) || (context.role === "SUPERVISEUR" && await isPowerTenant(context, salaryTenantId) && can(context, "team.salary.manage"));
      if (!allowedManager) return NextResponse.json({ error: "Permission insuffisante pour gérer les salaires." }, { status: 403 });
      const salaryAmount = Number(body.salaryAmount);
      const salaryFrequency = typeof body.salaryFrequency === "string" ? body.salaryFrequency : "MONTHLY";
      if (!Number.isSafeInteger(salaryAmount) || salaryAmount < 0 || !["MONTHLY", "WEEKLY", "DAILY"].includes(salaryFrequency)) return NextResponse.json({ error: "Montant et fréquence de salaire valides requis." }, { status: 400 });
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.from("employees").update({ salary_amount: salaryAmount, salary_currency: "XOF", salary_frequency: salaryFrequency, updated_at: new Date().toISOString() }).eq("id", salaryEmployeeId).eq("tenant_id", salaryTenantId).is("deleted_at", null).select("id,tenant_id,first_name,last_name,position,salary_amount,salary_currency,salary_frequency,updated_at").single();
      if (error || !data) return NextResponse.json({ error: "Impossible de mettre à jour le salaire." }, { status: 400 });
      return NextResponse.json({ employee: data });
    }
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const action = body.action === "approve" || body.action === "reject" ? body.action : "";
    if (!requestId || !tenantId || !action) return NextResponse.json({ error: "Demande et action valides requises." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!isOwner(context, tenantId)) return NextResponse.json({ error: "Seul le propriétaire peut valider une demande d’accès." }, { status: 403 });

    const admin = createSupabaseAdminClient();
    const { data: accessRequest, error: requestError } = await admin.from("employee_access_requests").select("id,tenant_id,user_id,phone,first_name,last_name,position,status").eq("id", requestId).eq("tenant_id", tenantId).eq("status", "PENDING").maybeSingle();
    if (requestError || !accessRequest) return NextResponse.json({ error: "Demande introuvable ou déjà traitée." }, { status: 404 });
    if (action === "reject") {
      const { error } = await admin.from("employee_access_requests").update({ status: "REJECTED", reviewed_at: new Date().toISOString(), reviewed_by: context.user.id }).eq("id", requestId).eq("tenant_id", tenantId);
      if (error) return NextResponse.json({ error: "Impossible de refuser la demande." }, { status: 400 });
      return NextResponse.json({ status: "REJECTED" });
    }

    const profile = await admin.from("profiles").upsert({ id: accessRequest.user_id, tenant_id: tenantId, first_name: accessRequest.first_name, last_name: accessRequest.last_name, phone: accessRequest.phone, user_type: "TENANT_STAFF", role: accessRequest.position, status: "ACTIVE" }).select("id").single();
    const employee = await admin.from("employees").insert({ tenant_id: tenantId, user_id: accessRequest.user_id, first_name: accessRequest.first_name, last_name: accessRequest.last_name, phone: accessRequest.phone, position: accessRequest.position, status: "ACTIVE", must_change_password: true, approved_at: new Date().toISOString(), approved_by: context.user.id }).select("id,tenant_id,user_id,first_name,last_name,phone,position,status,must_change_password,approved_at,created_at").single();
    if (profile.error || employee.error) return NextResponse.json({ error: "Impossible d’activer ce compte dans l’établissement." }, { status: 400 });
    const { error: updateError } = await admin.from("employee_access_requests").update({ status: "APPROVED", reviewed_at: new Date().toISOString(), reviewed_by: context.user.id }).eq("id", requestId).eq("tenant_id", tenantId);
    if (updateError) return NextResponse.json({ error: "Compte activé mais demande non clôturée. Actualisez le personnel." }, { status: 409 });
    return NextResponse.json({ employee: employee.data, status: "APPROVED" });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
