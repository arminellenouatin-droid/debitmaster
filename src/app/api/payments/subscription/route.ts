// DebitManager subscription: catalogue, calcul du tarif et initialisation Moneroo côté serveur.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addSubscriptionPeriod, getSubscriptionCatalog, getSubscriptionPlan, getSubscriptionPrice } from "@/lib/subscription-plans";

const monerooApiUrl = "https://api.moneroo.io/v1/payments/initialize";

function ownerTenantId(context: Awaited<ReturnType<typeof getAuthorizationContext>>, requestedTenantId: string) {
  if (context.employeeId) return null;
  const tenantId = requestedTenantId || context.tenantIds[0] || "";
  return (context.tenantIds as string[]).includes(tenantId) ? tenantId : null;
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

    const { data: payments, error: paymentsError } = await context.supabase
      .from("saas_subscription_payments")
      .select("id,plan,amount,currency,status,provider_reference,period_start,period_end,paid_at,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(12);
    if (paymentsError) return NextResponse.json({ error: "Impossible de charger l’historique d’abonnement." }, { status: 500 });

    return NextResponse.json({
      activity: { type: company.activity_type, currency: company.currency },
      plans: getSubscriptionCatalog(company.activity_type),
      current: { plan: company.subscription_plan, status: company.status, trialEndsAt: company.trial_ends_at, expiresAt: company.subscription_expires_at },
      payments: payments ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Impossible de charger les plans d’abonnement." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; plan?: string };
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const tenantId = ownerTenantId(context, typeof body.tenantId === "string" ? body.tenantId : "");
    if (!tenantId) return NextResponse.json({ error: "Seul le propriétaire peut modifier l’abonnement." }, { status: 403 });

    const plan = typeof body.plan === "string" ? body.plan.toUpperCase() : "";
    const definition = getSubscriptionPlan(plan);
    if (!definition) return NextResponse.json({ error: "Formule d’abonnement invalide." }, { status: 400 });

    const { data: company, error: companyError } = await context.supabase
      .from("companies")
      .select("id,name,activity_type,currency,subscription_expires_at")
      .eq("id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (companyError || !company) return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });

    const amount = getSubscriptionPrice(company.activity_type, plan);
    const apiKey = process.env.MONEROO_API_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (!apiKey || !appUrl) return NextResponse.json({ error: "Moneroo ou l’URL publique de retour n’est pas configuré." }, { status: 503 });

    const now = new Date();
    const existingEnd = company.subscription_expires_at ? new Date(company.subscription_expires_at) : null;
    const periodStart = existingEnd && existingEnd.getTime() > now.getTime() ? existingEnd : now;
    const periodEnd = addSubscriptionPeriod(periodStart, plan);
    if (!amount || !periodEnd) return NextResponse.json({ error: "Tarif d’abonnement indisponible." }, { status: 503 });
    const admin = createSupabaseAdminClient();
    const { data: payment, error: paymentError } = await admin
      .from("saas_subscription_payments")
      .insert({ tenant_id: tenantId, provider: "MONEROO", plan, amount, currency: company.currency || "XOF", status: "PENDING", period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), metadata: { activity_type: company.activity_type, duration_months: definition.durationMonths } })
      .select("id,tenant_id,plan,amount,currency,status,period_start,period_end")
      .single();
    if (paymentError || !payment) return NextResponse.json({ error: "Impossible de préparer l’abonnement." }, { status: 400 });

    const monerooResponse = await fetch(monerooApiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ amount, currency: company.currency || "XOF", description: `Abonnement DebitManager ${definition.label}`, return_url: `${appUrl}/dashboard/settings?subscription=${encodeURIComponent(payment.id)}`, customer: { email: context.user.email ?? "", first_name: context.user.user_metadata?.first_name ?? "", last_name: context.user.user_metadata?.last_name ?? "" }, metadata: { subscription_payment_id: payment.id, tenant_id: tenantId, plan } }),
    });
    const result = await monerooResponse.json().catch(() => null) as { data?: { id?: string; checkout_url?: string }; message?: string } | null;
    if (!monerooResponse.ok || !result?.data?.id || !result.data.checkout_url) {
      await admin.from("saas_subscription_payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("status", "PENDING");
      return NextResponse.json({ error: result?.message ?? "Moneroo n’a pas pu initialiser l’abonnement." }, { status: 502 });
    }

    const { data: updated, error: referenceError } = await admin
      .from("saas_subscription_payments")
      .update({ provider_reference: result.data.id, updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .select("id,tenant_id,plan,amount,currency,status,period_start,period_end,provider_reference")
      .single();
    if (referenceError || !updated) return NextResponse.json({ error: "Référence locale d’abonnement incomplète." }, { status: 500 });
    return NextResponse.json({ payment: updated, checkoutUrl: result.data.checkout_url });
  } catch {
    return NextResponse.json({ error: "Impossible de préparer l’abonnement Moneroo." }, { status: 500 });
  }
}
