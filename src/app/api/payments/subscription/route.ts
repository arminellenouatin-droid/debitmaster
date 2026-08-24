// DebitManager subscription payment: le plan et le montant sont décidés côté serveur, jamais par le navigateur.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const monerooApiUrl = "https://api.moneroo.io/v1/payments/initialize";
const planEnv: Record<string, string | undefined> = { BASE: process.env.SUBSCRIPTION_PRICE_BASE_XOF, MOYENNE: process.env.SUBSCRIPTION_PRICE_MOYENNE_XOF, SEMESTRIELLE: process.env.SUBSCRIPTION_PRICE_SEMESTRIELLE_XOF, SUPREME: process.env.SUBSCRIPTION_PRICE_SUPREME_XOF };
const periodDays: Record<string, number> = { BASE: 30, MOYENNE: 30, SEMESTRIELLE: 180, SUPREME: 365 };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; plan?: string };
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const plan = typeof body.plan === "string" ? body.plan.toUpperCase() : "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (context.employeeId || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Seul le propriétaire peut modifier l’abonnement." }, { status: 403 });
    if (!periodDays[plan]) return NextResponse.json({ error: "Formule d’abonnement invalide." }, { status: 400 });
    const amount = Number(planEnv[plan]);
    if (!Number.isInteger(amount) || amount <= 0) return NextResponse.json({ error: "Le tarif de cette formule n’est pas configuré côté serveur." }, { status: 503 });
    const apiKey = process.env.MONEROO_API_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (!apiKey || !appUrl) return NextResponse.json({ error: "Moneroo ou l’URL publique de retour n’est pas configuré." }, { status: 503 });
    const periodEnd = new Date(Date.now() + periodDays[plan] * 86400000).toISOString();
    const admin = createSupabaseAdminClient();
    const { data: payment, error: paymentError } = await admin.from("saas_subscription_payments").insert({ tenant_id: tenantId, provider: "MONEROO", plan, amount, currency: "XOF", status: "PENDING", period_start: new Date().toISOString(), period_end: periodEnd }).select("id,tenant_id,plan,amount,currency,status,period_end").single();
    if (paymentError || !payment) return NextResponse.json({ error: "Impossible de préparer l’abonnement." }, { status: 400 });
    const monerooResponse = await fetch(monerooApiUrl, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ amount, currency: "XOF", description: `Abonnement DebitManager ${plan}`, return_url: `${appUrl}/dashboard/settings?subscription=${encodeURIComponent(payment.id)}`, customer: { email: context.user.email ?? "", first_name: context.user.user_metadata?.first_name ?? "", last_name: context.user.user_metadata?.last_name ?? "" }, metadata: { subscription_payment_id: payment.id, tenant_id: tenantId, plan } }) });
    const result = await monerooResponse.json().catch(() => null) as { data?: { id?: string; checkout_url?: string }; message?: string } | null;
    if (!monerooResponse.ok || !result?.data?.id || !result.data.checkout_url) { await admin.from("saas_subscription_payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("status", "PENDING"); return NextResponse.json({ error: result?.message ?? "Moneroo n’a pas pu initialiser l’abonnement." }, { status: 502 }); }
    const { data: updated, error: referenceError } = await admin.from("saas_subscription_payments").update({ provider_reference: result.data.id, updated_at: new Date().toISOString() }).eq("id", payment.id).select("id,tenant_id,plan,amount,currency,status,provider_reference,period_end").single();
    if (referenceError || !updated) return NextResponse.json({ error: "Référence locale d’abonnement incomplète." }, { status: 500 });
    return NextResponse.json({ payment: updated, checkoutUrl: result.data.checkout_url });
  } catch { return NextResponse.json({ error: "Impossible de préparer l’abonnement Moneroo." }, { status: 500 }); }
}
