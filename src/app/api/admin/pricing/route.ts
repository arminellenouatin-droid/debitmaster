// DebitManager SaaS pricing: seuls les administrateurs plateforme peuvent modifier les montants persistés.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { subscriptionActivityCodes, subscriptionPlanCodes, getSubscriptionActivityCatalog, normalizeActivityCode } from "@/lib/subscription-plans";

const errorResponse = (message: string, status = 403) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const context = await getAuthorizationContext();
  if (!context.user) return errorResponse("Authentification requise.", 401);
  if (!context.isPlatformAdmin) return errorResponse("Accès super-administration requis.");

  const { data, error } = await context.supabase
    .from("saas_plan_prices")
    .select("id,activity_code,plan_code,price_xof,description,is_active,updated_at")
    .order("activity_code")
    .order("plan_code")
    .limit(100);
  if (error) return errorResponse("Impossible de charger les tarifs SaaS.", 500);
  return NextResponse.json({ prices: data ?? [], catalog: getSubscriptionActivityCatalog(data ?? []) });
}

export async function PATCH(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return errorResponse("Authentification requise.", 401);
    if (!context.isPlatformAdmin) return errorResponse("Accès super-administration requis.");
    const body = await request.json() as { activityCode?: string; planCode?: string; priceXof?: number; description?: string };
    const activityCode = normalizeActivityCode(typeof body.activityCode === "string" ? body.activityCode : "");
    const planCode = typeof body.planCode === "string" ? body.planCode.toUpperCase() : "";
    const priceXof = Number(body.priceXof);
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : "";
    if (!subscriptionActivityCodes.includes(activityCode as (typeof subscriptionActivityCodes)[number]) || !subscriptionPlanCodes.includes(planCode as (typeof subscriptionPlanCodes)[number]) || !Number.isSafeInteger(priceXof) || priceXof <= 0) {
      return errorResponse("Type d’établissement, période et prix valides requis.", 400);
    }

    const { data, error } = await context.supabase
      .from("saas_plan_prices")
      .upsert({ activity_code: activityCode, plan_code: planCode, price_xof: priceXof, description, is_active: true, updated_by: context.user.id, updated_at: new Date().toISOString() }, { onConflict: "activity_code,plan_code" })
      .select("id,activity_code,plan_code,price_xof,description,is_active,updated_at")
      .single();
    if (error || !data) return errorResponse("Impossible d’enregistrer ce tarif SaaS.", 400);
    return NextResponse.json({ price: data });
  } catch {
    return errorResponse("Requête invalide.", 400);
  }
}
