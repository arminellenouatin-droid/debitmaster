// DebitManager subscription: catalogue XOF administrable, Power multi-activités et initialisation MTN MoMo Collection côté serveur.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MtnMomoError, requestToPay } from "@/lib/mtn-momo";
import { addSubscriptionPeriod, getSubscriptionActivityCatalog, getSubscriptionCatalog, getSubscriptionPlan, getSubscriptionPrice, normalizeActivityCode, type SubscriptionPriceOverride } from "@/lib/subscription-plans";

function ownerTenantId(context: Awaited<ReturnType<typeof getAuthorizationContext>>, requestedTenantId: string) {
  if (context.employeeId) return null;
  const tenantId = requestedTenantId || context.tenantIds[0] || "";
  return (context.tenantIds as string[]).includes(tenantId) ? tenantId : null;
}

async function loadPriceOverrides(supabase: Awaited<ReturnType<typeof getAuthorizationContext>>["supabase"]) {
  const { data } = await supabase.from("saas_plan_prices").select("activity_code,plan_code,price_xof,description").eq("is_active", true).limit(100);
  return (data ?? []) as SubscriptionPriceOverride[];
}

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const tenantId = ownerTenantId(context, new URL(request.url).searchParams.get("tenantId") ?? "");
    if (!tenantId) return NextResponse.json({ error: "Seul le propriétaire peut consulter les plans de l’établissement." }, { status: 403 });

    const { data: company, error: companyError } = await context.supabase
      .from("companies")
      .select("id,name,activity_type,currency,status,trial_ends_at,subscription_plan,subscription_expires_at")
      .eq("id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (companyError || !company) return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });

    const [{ data: payments, error: paymentsError }, overrides] = await Promise.all([
      context.supabase.from("saas_subscription_payments").select("id,plan,amount,currency,status,provider_reference,period_start,period_end,paid_at,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(12),
      loadPriceOverrides(context.supabase),
    ]);
    if (paymentsError) return NextResponse.json({ error: "Impossible de charger l’historique d’abonnement." }, { status: 500 });

    return NextResponse.json({
      activity: { type: company.activity_type, currency: company.currency },
      plans: getSubscriptionCatalog(company.activity_type, overrides),
      activities: getSubscriptionActivityCatalog(overrides),
      current: { plan: company.subscription_plan, status: company.status, trialEndsAt: company.trial_ends_at, expiresAt: company.subscription_expires_at },
      payments: payments ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Impossible de charger les plans d’abonnement." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; plan?: string; mobileNumber?: string };
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const tenantId = ownerTenantId(context, typeof body.tenantId === "string" ? body.tenantId : "");
    if (!tenantId) return NextResponse.json({ error: "Seul le propriétaire peut modifier l’abonnement." }, { status: 403 });

    const plan = typeof body.plan === "string" ? body.plan.toUpperCase() : "";
    const mobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber.trim() : "";
    const definition = getSubscriptionPlan(plan);
    if (!definition) return NextResponse.json({ error: "Formule d’abonnement invalide." }, { status: 400 });
    if (!mobileNumber) return NextResponse.json({ error: "Le numéro MTN MoMo utilisé pour l’abonnement est obligatoire." }, { status: 400 });

    const { data: company, error: companyError } = await context.supabase
      .from("companies")
      .select("id,name,activity_type,currency,subscription_expires_at")
      .eq("id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (companyError || !company) return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });

    const overrides = await loadPriceOverrides(context.supabase);
    const amount = getSubscriptionPrice(company.activity_type, plan, overrides);
    const now = new Date();
    const existingEnd = company.subscription_expires_at ? new Date(company.subscription_expires_at) : null;
    const periodStart = existingEnd && existingEnd.getTime() > now.getTime() ? existingEnd : now;
    const periodEnd = addSubscriptionPeriod(periodStart, plan);
    if (!amount || !periodEnd) return NextResponse.json({ error: "Tarif d’abonnement indisponible." }, { status: 503 });

    const admin = createSupabaseAdminClient();
    const { data: payment, error: paymentError } = await admin
      .from("saas_subscription_payments")
      .insert({ tenant_id: tenantId, provider: "MTN_MOMO", plan, amount, currency: company.currency || "XOF", status: "PENDING", period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), metadata: { activity_type: normalizeActivityCode(company.activity_type), duration_months: definition.durationMonths } })
      .select("id,tenant_id,plan,amount,currency,status,period_start,period_end")
      .single();
    if (paymentError || !payment) return NextResponse.json({ error: "Impossible de préparer l’abonnement." }, { status: 400 });

    try {
      const initiated = await requestToPay({ amount, currency: company.currency || "XOF", customerPhone: mobileNumber, externalId: payment.id, payerMessage: `Abonnement ${definition.label}`, payeeNote: `DebitManager ${company.name}` });
      const { data: updated, error: referenceError } = await admin
        .from("saas_subscription_payments")
        .update({ provider_reference: initiated.referenceId, updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .eq("status", "PENDING")
        .select("id,tenant_id,plan,amount,currency,status,period_start,period_end,provider_reference")
        .single();
      if (referenceError || !updated) return NextResponse.json({ error: "Paiement initié mais référence locale d’abonnement incomplète. Vérifiez le statut avant une nouvelle tentative." }, { status: 500 });
      return NextResponse.json({ payment: updated, status: "PENDING", referenceId: initiated.referenceId });
    } catch (cause) {
      await admin.from("saas_subscription_payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("status", "PENDING");
      if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
      return NextResponse.json({ error: "MTN MoMo n’a pas pu initialiser l’abonnement." }, { status: 502 });
    }
  } catch (cause) {
    if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    return NextResponse.json({ error: "Impossible de préparer l’abonnement MTN MoMo." }, { status: 500 });
  }
}
