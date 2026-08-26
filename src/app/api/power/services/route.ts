// DebitManager Power: prestations non-stockées, avec prix gérés par le superviseur ou le propriétaire.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

const normalize = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function powerTenant(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string) {
  if (!tenantId || !(context.tenantIds as string[]).includes(tenantId)) return false;
  const { data } = await context.supabase.from("companies").select("id").eq("id", tenantId).eq("activity_type", "POWER").is("deleted_at", null).maybeSingle();
  return Boolean(data);
}

export async function GET(request: Request) {
  const context = await getAuthorizationContext();
  const tenantId = new URL(request.url).searchParams.get("tenantId") ?? context.tenantIds[0] ?? "";
  if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (!await powerTenant(context, tenantId) || !can(context, "services.view")) return NextResponse.json({ error: "Accès aux services Power refusé." }, { status: 403 });
  const activityCode = new URL(request.url).searchParams.get("activityCode")?.trim().toUpperCase() ?? "";
  let activityId = "";
  if (activityCode) {
    const { data: activity } = await context.supabase.from("company_activities").select("id").eq("tenant_id", tenantId).eq("activity_code", activityCode).eq("is_active", true).maybeSingle();
    activityId = activity?.id ?? "";
    if (!activityId) return NextResponse.json({ services: [] });
  }
  let query = context.supabase.from("company_services").select("id,tenant_id,activity_id,name,description,price_xof,billing_unit,is_active,created_at,updated_at").eq("tenant_id", tenantId).eq("is_active", true).order("name").limit(300);
  if (activityId) query = query.eq("activity_id", activityId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Impossible de charger les services Power." }, { status: 500 });
  return NextResponse.json({ services: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; activityId?: string; name?: string; description?: string; priceXof?: number; billingUnit?: string };
    const tenantId = normalize(body.tenantId);
    const activityId = normalize(body.activityId);
    const name = normalize(body.name);
    const description = normalize(body.description).slice(0, 500);
    const priceXof = Number(body.priceXof ?? 0);
    const billingUnit = normalize(body.billingUnit) || "UNIT";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!await powerTenant(context, tenantId) || !can(context, "services.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer les services Power." }, { status: 403 });
    if (!activityId || name.length < 2 || !Number.isSafeInteger(priceXof) || priceXof < 0) return NextResponse.json({ error: "Activité, nom et prix valides requis." }, { status: 400 });
    const { data: activity } = await context.supabase.from("company_activities").select("id").eq("id", activityId).eq("tenant_id", tenantId).maybeSingle();
    if (!activity) return NextResponse.json({ error: "Activité Power introuvable." }, { status: 404 });
    const { data, error } = await context.supabase.from("company_services").insert({ tenant_id: tenantId, activity_id: activityId, name: name.slice(0, 160), description: description || null, price_xof: priceXof, billing_unit: billingUnit.slice(0, 40), created_by: context.user.id }).select("id,tenant_id,activity_id,name,description,price_xof,billing_unit,is_active,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: "Impossible de créer le service Power." }, { status: 400 });
    return NextResponse.json({ service: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; serviceId?: string; name?: string; description?: string; priceXof?: number; billingUnit?: string; isActive?: boolean };
    const tenantId = normalize(body.tenantId);
    const serviceId = normalize(body.serviceId);
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!await powerTenant(context, tenantId) || !can(context, "services.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer les services Power." }, { status: 403 });
    const patch = {
      ...(body.name !== undefined ? { name: normalize(body.name).slice(0, 160) } : {}),
      ...(body.description !== undefined ? { description: normalize(body.description).slice(0, 500) || null } : {}),
      ...(body.priceXof !== undefined ? { price_xof: Number(body.priceXof) } : {}),
      ...(body.billingUnit !== undefined ? { billing_unit: normalize(body.billingUnit).slice(0, 40) } : {}),
      ...(body.isActive !== undefined ? { is_active: body.isActive } : {}),
      updated_at: new Date().toISOString(),
    };
    if (!serviceId || (patch.name !== undefined && patch.name.length < 2) || (patch.price_xof !== undefined && (!Number.isSafeInteger(patch.price_xof) || patch.price_xof < 0)) || (body.isActive !== undefined && typeof body.isActive !== "boolean")) return NextResponse.json({ error: "Service et valeurs valides requis." }, { status: 400 });
    const { data, error } = await context.supabase.from("company_services").update(patch).eq("id", serviceId).eq("tenant_id", tenantId).select("id,tenant_id,activity_id,name,description,price_xof,billing_unit,is_active,created_at,updated_at").single();
    if (error || !data) return NextResponse.json({ error: "Impossible de mettre à jour le service Power." }, { status: 400 });
    return NextResponse.json({ service: data });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
