// DebitManager équipe serveuses: lecture conditionnelle et mutations réservées à team.manage.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function validTime(value: unknown) { return value === null || value === "" || (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)); }

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId) || !can(context, "team.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les serveuses." }, { status: 403 });
    const admin = createSupabaseAdminClient();
    const { data: employees, error } = await admin.from("employees").select("id,tenant_id,user_id,first_name,last_name,phone,position,status,service_start_time,service_end_time,rest_day").eq("tenant_id", tenantId).eq("position", "SERVEUR").is("deleted_at", null).order("first_name").limit(100);
    if (error) {
      console.error("[team/serveuses.GET] employees query failed", { code: error.code, message: error.message });
      return NextResponse.json({ error: "Impossible de charger les serveuses.", diagnostic: "SERVEUSES_EMPLOYEES_QUERY_FAILED" }, { status: 500 });
    }
    const rows = employees ?? [];
    const employeeIds = rows.map((employee) => employee.id);
    const [tableAssignmentsResult, zoneAssignmentsResult] = await Promise.all([
      employeeIds.length ? admin.from("employee_table_assignments").select("id,employee_id,table_id").eq("tenant_id", tenantId).in("employee_id", employeeIds).limit(500) : { data: [], error: null },
      employeeIds.length ? admin.from("employee_zone_assignments").select("id,employee_id,zone_id").eq("tenant_id", tenantId).in("employee_id", employeeIds).limit(500) : { data: [], error: null },
    ]);
    const tableIds = [...new Set((tableAssignmentsResult.data ?? []).map((assignment) => assignment.table_id))];
    const zoneIds = [...new Set((zoneAssignmentsResult.data ?? []).map((assignment) => assignment.zone_id))];
    const [tablesResult, zonesResult] = await Promise.all([
      tableIds.length ? admin.from("dining_tables").select("id,label,zone,zone_id,capacity,status").eq("tenant_id", tenantId).in("id", tableIds).is("deleted_at", null).limit(500) : { data: [], error: null },
      zoneIds.length ? admin.from("work_zones").select("id,name,is_active").eq("tenant_id", tenantId).in("id", zoneIds).limit(500) : { data: [], error: null },
    ]);
    if (tableAssignmentsResult.error || zoneAssignmentsResult.error || tablesResult.error || zonesResult.error) {
      console.error("[team/serveuses.GET] assignment query failed", { tableAssignments: tableAssignmentsResult.error?.message, zoneAssignments: zoneAssignmentsResult.error?.message, tables: tablesResult.error?.message, zones: zonesResult.error?.message });
    }
    const tableMap = new Map((tablesResult.data ?? []).map((table) => [table.id, table]));
    const zoneMap = new Map((zonesResult.data ?? []).map((zone) => [zone.id, zone]));
    const serveuses = rows.map((employee) => ({ ...employee, employee_table_assignments: (tableAssignmentsResult.data ?? []).filter((assignment) => assignment.employee_id === employee.id).map((assignment) => ({ ...assignment, dining_tables: tableMap.get(assignment.table_id) ?? null })), employee_zone_assignments: (zoneAssignmentsResult.data ?? []).filter((assignment) => assignment.employee_id === employee.id).map((assignment) => ({ ...assignment, work_zones: zoneMap.get(assignment.zone_id) ?? null })) }));
    return NextResponse.json({ serveuses, permissions: { manage: can(context, "team.manage"), viewTables: can(context, "tables.view"), manageTables: can(context, "tables.manage") } });
  } catch (error) {
    console.error("[team/serveuses.GET] unexpected error", error);
    return NextResponse.json({ error: "Service temporairement indisponible.", diagnostic: "SERVEUSES_UNEXPECTED_ERROR" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const tableId = typeof body.tableId === "string" ? body.tableId : "";
    const zoneId = typeof body.zoneId === "string" ? body.zoneId : "";
    if (!tenantId || !employeeId || (!tableId && !zoneId)) return NextResponse.json({ error: "Serveuse et zone ou table requise." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "team.manage")) return NextResponse.json({ error: "Permission insuffisante pour affecter une table." }, { status: 403 });
    const [{ data: employee }, { data: table }, { data: zone }] = await Promise.all([
      context.supabase.from("employees").select("id").eq("id", employeeId).eq("tenant_id", tenantId).eq("position", "SERVEUR").is("deleted_at", null).maybeSingle(),
      tableId ? context.supabase.from("dining_tables").select("id,zone_id").eq("id", tableId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
      zoneId ? context.supabase.from("work_zones").select("id").eq("id", zoneId).eq("tenant_id", tenantId).eq("is_active", true).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!employee || (tableId && !table) || (zoneId && !zone)) return NextResponse.json({ error: "Serveuse, zone ou table introuvable dans cet établissement." }, { status: 404 });
    if (tableId && zoneId && table?.zone_id !== zoneId) return NextResponse.json({ error: "La table ne dépend pas de la zone sélectionnée." }, { status: 400 });
    if (zoneId) {
      const { data, error } = await context.supabase.from("employee_zone_assignments").insert({ tenant_id: tenantId, employee_id: employeeId, zone_id: zoneId, assigned_by: context.user.id }).select("id,employee_id,zone_id,created_at").single();
      if (error) return NextResponse.json({ error: "Cette zone est déjà attribuée à cette serveuse." }, { status: 409 });
      return NextResponse.json({ zoneAssignment: data }, { status: 201 });
    }
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
