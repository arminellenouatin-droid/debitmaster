// DebitManager Moneroo webhook: raw-body HMAC obligatoire, vérification fournisseur avant toute écriture, commission idempotente.
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const monerooVerifyUrl = (paymentId: string) => `https://api.moneroo.io/v1/payments/${encodeURIComponent(paymentId)}/verify`;
function signaturesMatch(payload: string, received: string, secret: string) { const expected = createHmac("sha256", secret).update(payload).digest("hex"); const expectedBuffer = Buffer.from(expected, "utf8"); const receivedBuffer = Buffer.from(received, "utf8"); return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer); }

type ProviderVerification = { data?: { id?: string; status?: string; amount?: number; currency?: { code?: string } } };

async function verifyMonerooPayment(providerReference: string, expectedAmount: number, expectedCurrency: string) {
  const apiKey = process.env.MONEROO_API_KEY;
  if (!apiKey) return false;
  const response = await fetch(monerooVerifyUrl(providerReference), { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, cache: "no-store" });
  const verification = await response.json().catch(() => null) as ProviderVerification | null;
  return response.ok && verification?.data?.id === providerReference && verification.data.status === "success" && Number(verification.data.amount) >= expectedAmount && verification.data.currency?.code === expectedCurrency;
}

async function issueAffiliateCommission(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, subscriptionPaymentId: string, amount: number) {
  const { data: company } = await admin.from("companies").select("affiliate_id").eq("id", tenantId).maybeSingle();
  if (!company?.affiliate_id) return;
  const { data: affiliate } = await admin.from("platform_affiliates").select("id,commission_rate,status").eq("id", company.affiliate_id).eq("status", "ACTIVE").maybeSingle();
  if (!affiliate) return;
  const commissionAmount = Math.floor(amount * Number(affiliate.commission_rate) / 100);
  await admin.from("affiliate_commissions").upsert({ affiliate_id: affiliate.id, tenant_id: tenantId, subscription_payment_id: subscriptionPaymentId, gross_amount: amount, commission_rate: affiliate.commission_rate, commission_amount: commissionAmount, currency: "XOF", status: "PENDING" }, { onConflict: "subscription_payment_id", ignoreDuplicates: true });
}

export async function POST(request: Request) {
  const secret = process.env.MONEROO_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook Moneroo non configuré." }, { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get("x-moneroo-signature") ?? "";
  if (!signature || !signaturesMatch(rawBody, signature, secret)) return NextResponse.json({ error: "Signature Moneroo invalide." }, { status: 403 });
  try {
    const payload = JSON.parse(rawBody) as { event?: string; data?: { id?: string } };
    const providerReference = payload.data?.id;
    if (!providerReference) return NextResponse.json({ received: true });
    const admin = createSupabaseAdminClient();
    const { data: subscription } = await admin.from("saas_subscription_payments").select("id,tenant_id,status,amount,currency,provider_reference").eq("provider_reference", providerReference).maybeSingle();
    if (subscription) {
      if (["SUCCEEDED", "FAILED", "REFUNDED"].includes(subscription.status)) return NextResponse.json({ received: true, alreadyProcessed: true });
      if (payload.event === "payment.failed") { await admin.from("saas_subscription_payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", subscription.id).eq("status", "PENDING"); return NextResponse.json({ received: true }); }
      if (payload.event !== "payment.success") return NextResponse.json({ received: true });
      const verified = await verifyMonerooPayment(providerReference, subscription.amount, subscription.currency);
      if (!verified) return NextResponse.json({ error: "Vérification Moneroo non concluante." }, { status: 422 });
      const { data: updated, error: updateError } = await admin.from("saas_subscription_payments").update({ status: "SUCCEEDED", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", subscription.id).eq("status", "PENDING").select("id,tenant_id,amount").maybeSingle();
      if (updateError) return NextResponse.json({ error: "Mise à jour de l’abonnement impossible." }, { status: 500 });
      if (updated) await issueAffiliateCommission(admin, updated.tenant_id, updated.id, updated.amount);
      return NextResponse.json({ received: true });
    }
    const { data: payment, error: paymentError } = await admin.from("payments").select("id,tenant_id,order_id,provider,status,amount,currency,provider_reference,paid_at").eq("provider", "MONEROO").eq("provider_reference", providerReference).maybeSingle();
    if (paymentError) return NextResponse.json({ error: "Lecture du paiement impossible." }, { status: 500 });
    if (!payment) return NextResponse.json({ received: true });
    if (["SUCCESS", "FAILED", "CANCELLED"].includes(payment.status)) return NextResponse.json({ received: true, alreadyProcessed: true });
    if (payload.event === "payment.failed") { await admin.from("payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", payment.tenant_id); return NextResponse.json({ received: true }); }
    if (payload.event === "payment.cancelled") { await admin.from("payments").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", payment.tenant_id); return NextResponse.json({ received: true }); }
    if (payload.event !== "payment.success") return NextResponse.json({ received: true });
    const verified = await verifyMonerooPayment(providerReference, payment.amount, payment.currency);
    if (!verified) return NextResponse.json({ error: "Vérification Moneroo non concluante." }, { status: 422 });
    const { error: updateError } = await admin.from("payments").update({ status: "SUCCESS", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", payment.tenant_id).eq("status", "PENDING");
    if (updateError) return NextResponse.json({ error: "Mise à jour du paiement impossible." }, { status: 500 });
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ error: "Payload Moneroo invalide." }, { status: 400 }); }
}
