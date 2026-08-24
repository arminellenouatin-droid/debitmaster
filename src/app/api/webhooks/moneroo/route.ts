// DebitManager Moneroo webhook: verify raw-body HMAC before any database write; keep this endpoint independent from browser sessions.
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const monerooVerifyUrl = (paymentId: string) => `https://api.moneroo.io/v1/payments/${encodeURIComponent(paymentId)}/verify`;

function signaturesMatch(payload: string, received: string, secret: string) {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: Request) {
  const secret = process.env.MONEROO_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook Moneroo non configuré." }, { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get("x-moneroo-signature") ?? "";
  if (!signature || !signaturesMatch(rawBody, signature, secret)) return NextResponse.json({ error: "Signature Moneroo invalide." }, { status: 403 });
  try {
    const payload = JSON.parse(rawBody) as { event?: string; data?: { id?: string; status?: string } };
    const providerReference = payload.data?.id;
    if (!providerReference) return NextResponse.json({ received: true });
    const admin = createSupabaseAdminClient();
    const { data: payment, error: paymentError } = await admin.from("payments").select("id,tenant_id,order_id,provider,status,amount,currency,provider_reference,paid_at").eq("provider", "MONEROO").eq("provider_reference", providerReference).maybeSingle();
    if (paymentError) return NextResponse.json({ error: "Lecture du paiement impossible." }, { status: 500 });
    if (!payment) return NextResponse.json({ received: true });
    if (payment.status === "SUCCESS" || payment.status === "FAILED" || payment.status === "CANCELLED") return NextResponse.json({ received: true, alreadyProcessed: true });
    if (payload.event === "payment.failed") { await admin.from("payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", payment.tenant_id); return NextResponse.json({ received: true }); }
    if (payload.event === "payment.cancelled") { await admin.from("payments").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", payment.tenant_id); return NextResponse.json({ received: true }); }
    if (payload.event !== "payment.success") return NextResponse.json({ received: true });
    const apiKey = process.env.MONEROO_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Clé API Moneroo absente pour la vérification." }, { status: 503 });
    const verificationResponse = await fetch(monerooVerifyUrl(providerReference), { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
    const verification = await verificationResponse.json().catch(() => null) as { data?: { id?: string; status?: string; amount?: number; currency?: { code?: string } } } | null;
    const verified = verificationResponse.ok && verification?.data?.id === providerReference && verification.data.status === "success" && Number(verification.data.amount) >= payment.amount && verification.data.currency?.code === payment.currency;
    if (!verified) return NextResponse.json({ error: "Vérification Moneroo non concluante." }, { status: 422 });
    const { error: updateError } = await admin.from("payments").update({ status: "SUCCESS", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", payment.tenant_id).eq("status", "PENDING");
    if (updateError) return NextResponse.json({ error: "Mise à jour du paiement impossible." }, { status: 500 });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Payload Moneroo invalide." }, { status: 400 });
  }
}
