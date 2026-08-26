// DebitManager subscription status: vérification MTN MoMo de secours et activation idempotente de la période payée.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { issueAffiliateCommission } from "@/lib/affiliate-commissions";
import { getCollectionStatus, MtnMomoError } from "@/lib/mtn-momo";

const terminalStatuses = new Set(["SUCCESSFUL", "FAILED", "REJECTED", "TIMEOUT", "CANCELLED"]);
function localStatus(providerStatus: string) { return providerStatus === "SUCCESSFUL" ? "SUCCEEDED" : terminalStatuses.has(providerStatus) ? "FAILED" : "PENDING"; }

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const paymentId = new URL(request.url).searchParams.get("paymentId") ?? "";
    if (!paymentId) return NextResponse.json({ error: "Identifiant de paiement requis." }, { status: 400 });
    const { data: payment, error } = await context.supabase.from("saas_subscription_payments").select("id,tenant_id,plan,amount,currency,status,provider,provider_reference,period_start,period_end,paid_at").eq("id", paymentId).maybeSingle();
    if (error || !payment || payment.provider !== "MTN_MOMO") return NextResponse.json({ error: "Paiement d’abonnement MTN MoMo introuvable." }, { status: 404 });
    if (!context.tenantIds.includes(payment.tenant_id)) return NextResponse.json({ error: "Paiement non autorisé." }, { status: 403 });
    if (["SUCCEEDED", "FAILED", "REFUNDED"].includes(payment.status) || !payment.provider_reference) return NextResponse.json({ payment, providerStatus: payment.status });

    const providerPayload = await getCollectionStatus(payment.provider_reference);
    const providerStatus = typeof providerPayload?.status === "string" ? providerPayload.status.toUpperCase() : "PENDING";
    const nextStatus = localStatus(providerStatus);
    if (nextStatus === "PENDING") return NextResponse.json({ payment, providerStatus });

    const admin = createSupabaseAdminClient();
    const paidAt = new Date().toISOString();
    const { data: updated, error: updateError } = await admin.from("saas_subscription_payments").update({ status: nextStatus, paid_at: nextStatus === "SUCCEEDED" ? paidAt : null, updated_at: paidAt }).eq("id", payment.id).eq("status", payment.status).select("id,tenant_id,plan,amount,period_end,status").maybeSingle();
    if (updateError) return NextResponse.json({ error: "Mise à jour de l’abonnement impossible." }, { status: 500 });
    if (updated?.status === "SUCCEEDED") {
      const { error: companyError } = await admin.from("companies").update({ subscription_plan: updated.plan, subscription_expires_at: updated.period_end, subscription_updated_at: paidAt, status: "ACTIVE", updated_at: paidAt }).eq("id", updated.tenant_id).is("deleted_at", null);
      if (companyError) return NextResponse.json({ error: "Paiement confirmé, mais l’activation de l’abonnement doit être rejouée." }, { status: 500 });
      await issueAffiliateCommission(admin, updated.tenant_id, updated.id, updated.amount);
    }
    return NextResponse.json({ payment: updated ?? payment, providerStatus });
  } catch (cause) {
    if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    return NextResponse.json({ error: "Impossible de vérifier le statut MTN MoMo de l’abonnement." }, { status: 502 });
  }
}
