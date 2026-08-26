// DebitManager MTN MoMo status: polling de secours après RequestToPay, avec mise à jour idempotente du paiement local.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCollectionStatus, MtnMomoError } from "@/lib/mtn-momo";

const terminalProviderStatuses = new Set(["SUCCESSFUL", "FAILED", "REJECTED", "TIMEOUT", "CANCELLED"]);

function localStatus(providerStatus: string) {
  return providerStatus === "SUCCESSFUL" ? "SUCCEEDED" : terminalProviderStatuses.has(providerStatus) ? "FAILED" : "PENDING";
}

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const paymentId = new URL(request.url).searchParams.get("paymentId") ?? "";
    if (!paymentId) return NextResponse.json({ error: "Identifiant de paiement requis." }, { status: 400 });

    const { data: payment, error } = await context.supabase.from("payments").select("id,tenant_id,order_id,status,amount,currency,provider,provider_reference,paid_at").eq("id", paymentId).maybeSingle();
    if (error || !payment || payment.provider !== "MTN_MOMO") return NextResponse.json({ error: "Paiement MTN MoMo introuvable." }, { status: 404 });
    if (!context.tenantIds.includes(payment.tenant_id)) return NextResponse.json({ error: "Paiement non autorisé." }, { status: 403 });
    if (["SUCCEEDED", "FAILED", "REFUNDED"].includes(payment.status) || !payment.provider_reference) return NextResponse.json({ payment, providerStatus: payment.status });

    const providerPayload = await getCollectionStatus(payment.provider_reference);
    const providerStatus = typeof providerPayload?.status === "string" ? providerPayload.status.toUpperCase() : "PENDING";
    const nextStatus = localStatus(providerStatus);
    if (nextStatus === "PENDING") return NextResponse.json({ payment, providerStatus });

    const admin = createSupabaseAdminClient();
    const paidAt = new Date().toISOString();
    const { data: updated, error: updateError } = await admin.from("payments").update({ status: nextStatus, paid_at: nextStatus === "SUCCEEDED" ? paidAt : null, updated_at: paidAt }).eq("id", payment.id).eq("status", payment.status).select("id,tenant_id,order_id,status,amount,currency,provider,provider_reference,paid_at").maybeSingle();
    if (updateError) return NextResponse.json({ error: "Mise à jour du paiement impossible." }, { status: 500 });
    if (updated?.status === "SUCCEEDED" && updated.order_id) {
      const { error: settleError } = await admin.rpc("settle_order_stock_after_payment", { p_order_id: updated.order_id });
      if (settleError && !["PAYMENT_INCOMPLETE", "ORDER_STOCK_NOT_ALLOCATED"].includes(settleError.message)) return NextResponse.json({ error: "Paiement confirmé, mais la clôture du stock doit être rejouée." }, { status: 500 });
    }
    return NextResponse.json({ payment: updated ?? payment, providerStatus });
  } catch (cause) {
    if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    return NextResponse.json({ error: "Impossible de vérifier le statut MTN MoMo." }, { status: 502 });
  }
}
