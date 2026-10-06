// DebitMaster PawaPay Unified Webhook Handler
// Handles callbacks for deposits, payouts, refunds, and checkout sessions idempotently.
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { issueAffiliateCommission } from "@/lib/affiliate-commissions";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "pawapay-webhook",
    status: "active",
    timestamp: new Date().toISOString(),
  });
}

type PawaPayDepositPayload = {
  depositId?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  clientReferenceId?: string;
  metadata?: Array<Record<string, unknown>> | Record<string, unknown>;
  failureReason?: {
    failureCode?: string;
    failureMessage?: string;
  };
};

type PawaPayRefundPayload = {
  refundId?: string;
  depositId?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  clientReferenceId?: string;
};

type PawaPayPayoutPayload = {
  payoutId?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  clientReferenceId?: string;
};

export async function handlePawaPayPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ received: true, ignored: "empty_or_invalid_payload" });
  }
  const payloadRecord = payload as Record<string, unknown>;

  const admin = createSupabaseAdminClient();

  // 1. REFOUND / REMBOURSEMENT
  if ("refundId" in payloadRecord && payloadRecord.refundId) {
    const refund = payloadRecord as PawaPayRefundPayload;
    const refundId = String(refund.refundId);
    const depositId = refund.depositId ? String(refund.depositId) : "";
    const status = (refund.status || "").toUpperCase();

    if (status === "COMPLETED") {
      if (depositId) {
        await admin
          .from("saas_subscription_payments")
          .update({ status: "REFUNDED", updated_at: new Date().toISOString() })
          .eq("provider_reference", depositId);

        await admin
          .from("payments")
          .update({ status: "REFUNDED", updated_at: new Date().toISOString() })
          .eq("provider_reference", depositId);
      }
    }
    return NextResponse.json({ received: true, type: "refund", refundId, status });
  }

  // 2. PAYOUT / PAIEMENT (DÉCAISSEMENT AFFILIÉ / RETRAIT)
  if ("payoutId" in payloadRecord && payloadRecord.payoutId) {
    const payout = payloadRecord as PawaPayPayoutPayload;
    const payoutId = String(payout.payoutId);
    const status = (payout.status || "").toUpperCase();

    if (status === "COMPLETED" && payout.clientReferenceId) {
      // Met à jour la commission d'affilié si la référence correspond
      await admin
        .from("affiliate_commissions")
        .update({ status: "PAID", updated_at: new Date().toISOString() })
        .eq("id", payout.clientReferenceId);
    }
    return NextResponse.json({ received: true, type: "payout", payoutId, status });
  }

  // 3. DEPOSIT OU CHECKOUT (DÉPÔT / ENCAISSEMENT)
  if ("depositId" in payloadRecord && payloadRecord.depositId) {
    const deposit = payloadRecord as PawaPayDepositPayload;
    const depositId = String(deposit.depositId);
    const clientRef = deposit.clientReferenceId ? String(deposit.clientReferenceId) : "";
    const status = (deposit.status || "").toUpperCase();

    // Recherche d'abord dans les abonnements SaaS
    const { data: subscription } = await admin
      .from("saas_subscription_payments")
      .select("id, tenant_id, plan, amount, currency, status, provider_reference, period_end")
      .or(`provider_reference.eq.${depositId},id.eq.${clientRef}`)
      .maybeSingle();

    if (subscription) {
      if (["SUCCEEDED", "FAILED", "REFUNDED"].includes(subscription.status)) {
        return NextResponse.json({ received: true, alreadyProcessed: true });
      }

      if (status === "FAILED") {
        await admin
          .from("saas_subscription_payments")
          .update({ status: "FAILED", updated_at: new Date().toISOString() })
          .eq("id", subscription.id)
          .eq("status", "PENDING");
        return NextResponse.json({ received: true, status: "FAILED" });
      }

      if (status === "COMPLETED") {
        const paidAt = new Date().toISOString();
        const { data: updated } = await admin
          .from("saas_subscription_payments")
          .update({
            status: "SUCCEEDED",
            paid_at: paidAt,
            provider: "PAWAPAY",
            provider_reference: depositId,
            updated_at: paidAt,
          })
          .eq("id", subscription.id)
          .eq("status", "PENDING")
          .select("id, tenant_id, plan, amount, period_end")
          .maybeSingle();

        if (updated) {
          await admin
            .from("companies")
            .update({
              subscription_plan: updated.plan,
              subscription_expires_at: updated.period_end,
              subscription_updated_at: paidAt,
              status: "ACTIVE",
              updated_at: paidAt,
            })
            .eq("id", updated.tenant_id)
            .is("deleted_at", null);

          await issueAffiliateCommission(
            admin,
            updated.tenant_id,
            updated.id,
            Number(updated.amount)
          );
        }
        return NextResponse.json({ received: true, status: "SUCCEEDED" });
      }

      return NextResponse.json({ received: true, status: "PENDING" });
    }

    // Sinon, recherche dans les paiements de commandes en point de vente
    const { data: payment } = await admin
      .from("payments")
      .select("id, tenant_id, order_id, amount, currency, status, provider_reference")
      .or(`provider_reference.eq.${depositId},id.eq.${clientRef}`)
      .maybeSingle();

    if (payment) {
      if (["SUCCEEDED", "FAILED", "REFUNDED"].includes(payment.status)) {
        return NextResponse.json({ received: true, alreadyProcessed: true });
      }

      if (status === "FAILED") {
        await admin
          .from("payments")
          .update({ status: "FAILED", updated_at: new Date().toISOString() })
          .eq("id", payment.id);
        return NextResponse.json({ received: true, status: "FAILED" });
      }

      if (status === "COMPLETED") {
        const paidAt = new Date().toISOString();
        await admin
          .from("payments")
          .update({
            status: "SUCCEEDED",
            provider: "PAWAPAY",
            provider_reference: depositId,
            updated_at: paidAt,
          })
          .eq("id", payment.id);

        if (payment.order_id) {
          await admin
            .from("orders")
            .update({ payment_status: "PAID", updated_at: paidAt })
            .eq("id", payment.order_id);
        }
        return NextResponse.json({ received: true, status: "SUCCEEDED" });
      }

      return NextResponse.json({ received: true, status: "PENDING" });
    }

    return NextResponse.json({ received: true, unmappedDeposit: depositId });
  }

  // Notification générique ou validation ping
  return NextResponse.json({ received: true });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ received: true, notice: "empty_ping" });
    }
    const payload = JSON.parse(rawBody);
    return await handlePawaPayPayload(payload);
  } catch (error) {
    console.error("PawaPay webhook error:", error);
    return NextResponse.json({ received: true, parseError: true });
  }
}
