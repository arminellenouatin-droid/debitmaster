// DebitManager MTN MoMo webhook: callback sans confiance, vérification GET fournisseur avant toute écriture métier.
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { issueAffiliateCommission } from "@/lib/affiliate-commissions";
import { getCollectionStatus, isProviderCurrencyAccepted, MtnMomoError } from "@/lib/mtn-momo";

type CallbackPayload = { externalId?: string; referenceId?: string; status?: string; amount?: string | number; currency?: string; financialTransactionId?: string };
const terminalStatuses = new Set(["SUCCESSFUL", "FAILED", "REJECTED", "TIMEOUT", "CANCELLED"]);

async function findByReference(admin: ReturnType<typeof createSupabaseAdminClient>, reference: string) {
  const { data: subscription } = await admin.from("saas_subscription_payments").select("id,tenant_id,plan,amount,currency,status,provider,provider_reference,period_end").or(`provider_reference.eq.${reference},id.eq.${reference}`).maybeSingle();
  if (subscription) return { kind: "subscription" as const, payment: subscription };
  const { data: payment } = await admin.from("payments").select("id,tenant_id,order_id,amount,currency,status,provider,provider_reference").or(`provider_reference.eq.${reference},id.eq.${reference}`).maybeSingle();
  return payment ? { kind: "order" as const, payment } : null;
}

async function handle(request: Request) {
  const rawBody = await request.text();
  let payload: CallbackPayload;
  try { payload = JSON.parse(rawBody) as CallbackPayload; } catch { return NextResponse.json({ error: "Payload MTN MoMo invalide." }, { status: 400 }); }
  const reference = payload.externalId || payload.referenceId || payload.financialTransactionId || "";
  if (!reference) return NextResponse.json({ received: true });

  try {
    const admin = createSupabaseAdminClient();
    const found = await findByReference(admin, reference);
    if (!found) return NextResponse.json({ received: true });
    const payment = found.payment;
    if (payment.provider !== "MTN_MOMO") return NextResponse.json({ received: true });
    if (["SUCCEEDED", "FAILED", "REFUNDED"].includes(payment.status)) return NextResponse.json({ received: true, alreadyProcessed: true });
    const callbackStatus = typeof payload.status === "string" ? payload.status.toUpperCase() : "PENDING";
    if (!terminalStatuses.has(callbackStatus)) return NextResponse.json({ received: true, status: "PENDING" });

    const providerReference = payment.provider_reference || (payload.referenceId ?? "");
    if (!providerReference) return NextResponse.json({ error: "Référence MTN MoMo absente." }, { status: 422 });
    const verification = await getCollectionStatus(providerReference);
    const verifiedStatus = typeof verification?.status === "string" ? verification.status.toUpperCase() : "";
    if (verifiedStatus !== callbackStatus) return NextResponse.json({ error: "Statut MTN MoMo non concordant." }, { status: 422 });
    if (callbackStatus === "SUCCESSFUL" && (Number(payload.amount) !== Number(payment.amount) || !isProviderCurrencyAccepted(payload.currency, payment.currency))) return NextResponse.json({ error: "Montant ou devise MTN MoMo non concordant." }, { status: 422 });

    const now = new Date().toISOString();
    const nextStatus = callbackStatus === "SUCCESSFUL" ? "SUCCEEDED" : "FAILED";
    if (found.kind === "subscription") {
      const { data: updated, error } = await admin.from("saas_subscription_payments").update({ status: nextStatus, paid_at: nextStatus === "SUCCEEDED" ? now : null, updated_at: now }).eq("id", payment.id).eq("status", payment.status).select("id,tenant_id,plan,amount,period_end,status").maybeSingle();
      if (error) return NextResponse.json({ error: "Mise à jour de l’abonnement impossible." }, { status: 500 });
      if (updated?.status === "SUCCEEDED") {
        const { error: companyError } = await admin.from("companies").update({ subscription_plan: updated.plan, subscription_expires_at: updated.period_end, subscription_updated_at: now, status: "ACTIVE", updated_at: now }).eq("id", updated.tenant_id).is("deleted_at", null);
        if (companyError) return NextResponse.json({ error: "Paiement confirmé, mais l’activation de l’abonnement doit être rejouée." }, { status: 500 });
        await issueAffiliateCommission(admin, updated.tenant_id, updated.id, updated.amount);
      }
    } else {
      const { data: updated, error } = await admin.from("payments").update({ status: nextStatus, paid_at: nextStatus === "SUCCEEDED" ? now : null, updated_at: now }).eq("id", payment.id).eq("status", payment.status).select("id,order_id,status").maybeSingle();
      if (error) return NextResponse.json({ error: "Mise à jour du paiement impossible." }, { status: 500 });
      if (updated?.status === "SUCCEEDED" && updated.order_id) {
        const { error: settleError } = await admin.rpc("settle_order_stock_after_payment", { p_order_id: updated.order_id });
        if (settleError && !["PAYMENT_INCOMPLETE", "ORDER_STOCK_NOT_ALLOCATED"].includes(settleError.message)) return NextResponse.json({ error: "Paiement confirmé, mais la clôture du stock doit être rejouée." }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  } catch (cause) {
    if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    console.error("[mtn-momo.webhook] unexpected error", { name: cause instanceof Error ? cause.name : "unknown", message: cause instanceof Error ? cause.message : "unknown" });
    return NextResponse.json({ error: "Traitement du callback MTN MoMo impossible." }, { status: 502 });
  }
}

export async function POST(request: Request) { return handle(request); }
export async function PUT(request: Request) { return handle(request); }
