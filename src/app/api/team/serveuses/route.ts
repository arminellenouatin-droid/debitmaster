// DebitManager équipe serveuses: lecture conditionnelle et mutations réservées à team.manage.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

function validTime(value: unknown) { return value === null || value === "" || (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)); }

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId) || !can(context, "team.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les serveuses." }, { status: 403 });
    const { data, error } = await context.supabase.from("employees").select("id,tenant_id,user_id,first_name,last_name,phone,position,status,service_start_time,service_end_time,rest_day,employee_table_assignments(id,table_id,dining_tables(id,label,zone,capacity,status))").eq("tenant_id", tenantId).eq("position", "SERVEUR").is("deleted_at", null).order("first_name").limit(100);
    if (error) return NextResponse.json({ error: "Impossible de charger les serveuses." }, { status: 500 });
    return NextResponse.json({ serveuses: data ?? [], permissions: { manage: can(context, "team.manage"), viewTables: can(context, "tables.view"), manageTables: can(context, "tables.manage") } });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const tableId = typeof body.tableId === "string" ? body.tableId : "";
    if (!tenantId || !employeeId || !tableId) return NextResponse.json({ error: "Serveuse et table requises." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "team.manage")) return NextResponse.json({ error: "Permission insuffisante pour affecter une table." }, { status: 403 });
    const [{ data: employee }, { data: table }] = await Promise.all([
      context.supabase.from("employees").select("id").eq("id", employeeId).eq("tenant_id", tenantId).eq("position", "SERVEUR").is("deleted_at", null).maybeSingle(),
      context.supabase.from("dining_tables").select("id").eq("id", tableId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle(),
    ]);
    if (!employee || !table) return NextResponse.json({ error: "Serveuse ou table introuvable dans cet établissement." }, { status: 404 });
    const { data, error } = await context.supabase.from("employee_table_assignments").insert({ tenant_id: tenantId, employee_id: employeeId, table_id: tableId, assigned_by: context.user.id }).select("id,employee_id,table_id,created_at").single();
    if (error) return NextResponse.json({ error: "Cette table est déjà attribuée à cette serveuse." }, { status: 409 });
    return NextResponse.json({ assignment: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : "";
    if (!tenantId || !assignmentId) return NextResponse.json({ error: "Affectation requise." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "team.manage")) return NextResponse.json({ error: "Permission insuffisante pour retirer une affectation." }, { status: 403 });
    const { error } = await context.supabase.from("employee_table_assignments").delete().eq("id", assignmentId).eq("tenant_id", tenantId);
    if (error) return NextResponse.json({ error: "Impossible de retirer l’affectation." }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const serviceStartTime = body.serviceStartTime === "" ? null : body.serviceStartTime;
    const serviceEndTime = body.serviceEndTime === "" ? null : body.serviceEndTime;
    const restDay = body.restDay === null || body.restDay === "" ? null : Number(body.restDay);
    if (!tenantId || !employeeId || !validTime(serviceStartTime) || !validTime(serviceEndTime) || (restDay !== null && (!Number.isInteger(restDay) || restDay < 0 || restDay > 6))) return NextResponse.json({ error: "Horaires et jour de repos valides requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "team.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer les horaires." }, { status: 403 });
    const { data, error } = await context.supabase.from("employees").update({ service_start_time: serviceStartTime, service_end_time: serviceEndTime, rest_day: restDay, updated_at: new Date().toISOString() }).eq("id", employeeId).eq("tenant_id", tenantId).eq("position", "SERVEUR").is("deleted_at", null).select("id,tenant_id,first_name,last_name,position,service_start_time,service_end_time,rest_day").single();
    if (error || !data) return NextResponse.json({ error: "Impossible de mettre à jour l’emploi du temps." }, { status: 400 });
    return NextResponse.json({ serveuse: data });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
