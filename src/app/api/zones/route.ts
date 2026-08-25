// DebitManager work zones: tenant-scoped CRUD for the Gerant's Plan de site.
import { NextResponse } from "next/server";
import { can, getAuthorizationContext } from "@/lib/authorization";

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function cleanDescription(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 300) : null;
}

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId) || !can(context, "tables.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les zones." }, { status: 403 });
    const { data, error } = await context.supabase
      .from("work_zones")
      .select("id,tenant_id,name,description,is_active,created_at,updated_at,dining_tables(id,label,capacity,status,zone_id)")
      .eq("tenant_id", tenantId)
      .order("name")
      .limit(100);
    if (error) return NextResponse.json({ error: "Impossible de charger les zones." }, { status: 500 });
    return NextResponse.json({ zones: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const name = cleanName(body.name);
    if (!tenantId || name.length < 1) return NextResponse.json({ error: "Établissement et nom de zone requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "tables.manage")) return NextResponse.json({ error: "Permission insuffisante pour créer une zone." }, { status: 403 });
    const { data, error } = await context.supabase.from("work_zones").insert({ tenant_id: tenantId, name, description: cleanDescription(body.description), created_by: context.user.id }).select("id,tenant_id,name,description,is_active,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: "Impossible de créer la zone. Ce nom existe peut-être déjà." }, { status: 409 });
    return NextResponse.json({ zone: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const zoneId = typeof body.zoneId === "string" ? body.zoneId : "";
    const name = cleanName(body.name);
    const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;
    if (!tenantId || !zoneId || (!name && isActive === undefined)) return NextResponse.json({ error: "Zone et modification requises." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "tables.manage")) return NextResponse.json({ error: "Permission insuffisante pour modifier une zone." }, { status: 403 });
    const changes = { ...(name ? { name } : {}), ...(isActive === undefined ? {} : { is_active: isActive }), updated_at: new Date().toISOString() };
    const { data, error } = await context.supabase.from("work_zones").update(changes).eq("id", zoneId).eq("tenant_id", tenantId).select("id,tenant_id,name,description,is_active,created_at,updated_at").single();
    if (error || !data) return NextResponse.json({ error: "Impossible de modifier cette zone." }, { status: 400 });
    return NextResponse.json({ zone: data });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
