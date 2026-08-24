// DebitManager permissions: seul le propriétaire de l’établissement modifie les overrides RBAC.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { permissionCatalog } from "@/lib/staff-permissions";

function isOwner(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string) {
  return Boolean(context.user && !context.employeeId && context.tenantIds.includes(tenantId));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const employeeId = url.searchParams.get("employeeId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !employeeId || !isOwner(context, tenantId)) return NextResponse.json({ error: "Seul le propriétaire peut consulter ces droits." }, { status: 403 });
    const { data: employee } = await context.supabase.from("employees").select("id,tenant_id,position").eq("id", employeeId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle();
    if (!employee) return NextResponse.json({ error: "Collaborateur introuvable dans cet établissement." }, { status: 404 });
    const { data, error } = await context.supabase.from("employee_permissions").select("id,permission_key,enabled,updated_at").eq("employee_id", employeeId).eq("tenant_id", tenantId).order("permission_key").limit(100);
    if (error) return NextResponse.json({ error: "Impossible de charger les droits." }, { status: 500 });
    return NextResponse.json({ permissionCatalog, overrides: data ?? [] });
  } catch { return NextResponse.json({ error: "Service des droits temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const permissionKey = typeof body.permissionKey === "string" ? body.permissionKey : "";
    const enabled = typeof body.enabled === "boolean" ? body.enabled : null;
    if (!tenantId || !employeeId || !permissionKey || enabled === null || !permissionCatalog.some((permission) => permission.key === permissionKey)) return NextResponse.json({ error: "Permission et état valides requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!isOwner(context, tenantId)) return NextResponse.json({ error: "Seul le propriétaire peut modifier ces droits." }, { status: 403 });
    const { data: employee } = await context.supabase.from("employees").select("id").eq("id", employeeId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle();
    if (!employee) return NextResponse.json({ error: "Collaborateur introuvable dans cet établissement." }, { status: 404 });
    const { data, error } = await context.supabase.from("employee_permissions").upsert({ tenant_id: tenantId, employee_id: employeeId, permission_key: permissionKey, enabled, updated_at: new Date().toISOString() }, { onConflict: "employee_id,permission_key" }).select("id,permission_key,enabled,updated_at").single();
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer ce droit." }, { status: 400 });
    return NextResponse.json({ override: data });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
