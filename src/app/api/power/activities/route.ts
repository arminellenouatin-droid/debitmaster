// DebitManager Power: activités multi-départements, accessibles uniquement dans un établissement sous plan POWER.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

const activityCodes = ["BEVERAGE", "FOOD", "GYM", "LAUNDRY", "LODGING", "WIFI"] as const;
const normalize = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function powerTenant(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string) {
  if (!tenantId || !(context.tenantIds as string[]).includes(tenantId)) return false;
  const { data } = await context.supabase.from("companies").select("id,activity_type").eq("id", tenantId).eq("activity_type", "POWER").is("deleted_at", null).maybeSingle();
  return Boolean(data);
}

export async function GET(request: Request) {
  const context = await getAuthorizationContext();
  const tenantId = new URL(request.url).searchParams.get("tenantId") ?? context.tenantIds[0] ?? "";
  if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (!await powerTenant(context, tenantId) || !can(context, "activities.view")) return NextResponse.json({ error: "Accès aux activités Power refusé." }, { status: 403 });
  const { data, error } = await context.supabase.from("company_activities").select("id,tenant_id,activity_code,name,is_active,created_at,updated_at").eq("tenant_id", tenantId).order("name").limit(100);
  if (error) return NextResponse.json({ error: "Impossible de charger les activités Power." }, { status: 500 });
  return NextResponse.json({ activities: data ?? [], activityCodes });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; activityCode?: string; name?: string };
    const tenantId = normalize(body.tenantId);
    const activityCode = normalize(body.activityCode).toUpperCase();
    const name = normalize(body.name);
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!await powerTenant(context, tenantId) || !can(context, "activities.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer les activités Power." }, { status: 403 });
    if (!activityCodes.includes(activityCode as (typeof activityCodes)[number]) || name.length < 2) return NextResponse.json({ error: "Code d’activité et nom valides requis." }, { status: 400 });
    const { data, error } = await context.supabase.from("company_activities").insert({ tenant_id: tenantId, activity_code: activityCode, name: name.slice(0, 120), created_by: context.user.id }).select("id,tenant_id,activity_code,name,is_active,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: "Impossible de créer l’activité Power." }, { status: 400 });
    return NextResponse.json({ activity: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; activityId?: string; name?: string; isActive?: boolean };
    const tenantId = normalize(body.tenantId);
    const activityId = normalize(body.activityId);
    const name = body.name === undefined ? undefined : normalize(body.name).slice(0, 120);
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!await powerTenant(context, tenantId) || !can(context, "activities.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer les activités Power." }, { status: 403 });
    if (!activityId || (name !== undefined && name.length < 2) || (body.isActive !== undefined && typeof body.isActive !== "boolean")) return NextResponse.json({ error: "Activité et valeurs valides requises." }, { status: 400 });
    const patch = { ...(name !== undefined ? { name } : {}), ...(body.isActive !== undefined ? { is_active: body.isActive } : {}), updated_at: new Date().toISOString() };
    const { data, error } = await context.supabase.from("company_activities").update(patch).eq("id", activityId).eq("tenant_id", tenantId).select("id,tenant_id,activity_code,name,is_active,created_at,updated_at").single();
    if (error || !data) return NextResponse.json({ error: "Impossible de mettre à jour l’activité Power." }, { status: 400 });
    return NextResponse.json({ activity: data });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
