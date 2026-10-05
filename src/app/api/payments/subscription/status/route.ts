// DebitMaster subscription status: vérification PawaPay et activation idempotente de la période payée.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { issueAffiliateCommission } from "@/lib/affiliate-commissions";
import { getDepositStatus, PawaPayError } from "@/lib/pawapay";
import { getCollectionStatus, MtnMomoError } from "@/lib/mtn-momo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user)
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 }
      );
    const paymentId = new URL(request.url).searchParams.get("paymentId") ?? "";
    if (!paymentId)
      return NextResponse.json(
        { error: "Identifiant de paiement requis." },
        { status: 400 }
      );

    const { data: payment, error } = await context.supabase
      .from("saas_subscription_payments")
      .select(
        "id,tenant_id,plan,billing_period,amount,currency,status,provider,provider_reference,period_start,period_end,paid_at"
      )
      .eq("id", paymentId)
      .maybeSingle();

    if (error || !payment)
      return NextResponse.json(
        { error: "Paiement d’abonnement introuvable." },
        { status: 404 }
      );

    if (!context.allTenantIds.includes(payment.tenant_id))
      return NextResponse.json(
        { error: "Paiement non autorisé." },
        { status: 403 }
      );

    if (
      ["SUCCEEDED", "FAILED", "REFUNDED"].includes(payment.status) ||
      !payment.provider_reference
    ) {
      return NextResponse.json({ payment, providerStatus: payment.status });
    }

    const admin = createSupabaseAdminClient();
    let nextStatus: "SUCCEEDED" | "FAILED" | "PENDING" = "PENDING";
    let providerStatus = "PENDING";

    // 1. PawaPay Provider
    if (payment.provider === "PAWAPAY" || !payment.provider) {
      try {
        const check = await getDepositStatus(
          payment.provider_reference || payment.id
        );
        providerStatus = check.status;
        if (check.status === "COMPLETED") {
          nextStatus = "SUCCEEDED";
        } else if (["FAILED", "REJECTED"].includes(check.status)) {
          nextStatus = "FAILED";
        }
      } catch (pawapayErr) {
        console.error("Error checking PawaPay status:", pawapayErr);
        // Fallback to current payment status
        return NextResponse.json({ payment, providerStatus: payment.status });
      }
    }
    // 2. Legacy MTN_MOMO Provider fallback
    else if (payment.provider === "MTN_MOMO") {
      try {
        const mtnPayload = await getCollectionStatus(payment.provider_reference);
        providerStatus =
          typeof mtnPayload?.status === "string"
            ? mtnPayload.status.toUpperCase()
            : "PENDING";
        if (providerStatus === "SUCCESSFUL") nextStatus = "SUCCEEDED";
        else if (["FAILED", "REJECTED", "TIMEOUT", "CANCELLED"].includes(providerStatus))
          nextStatus = "FAILED";
      } catch {
        return NextResponse.json({ payment, providerStatus: payment.status });
      }
    }

    if (nextStatus === "PENDING") {
      return NextResponse.json({ payment, providerStatus });
    }

    const paidAt = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("saas_subscription_payments")
      .update({
        status: nextStatus,
        paid_at: nextStatus === "SUCCEEDED" ? paidAt : null,
        updated_at: paidAt,
      })
      .eq("id", payment.id)
      .eq("status", payment.status)
      .select("id,tenant_id,plan,billing_period,amount,period_end,status")
      .maybeSingle();

    if (updateError)
      return NextResponse.json(
        { error: "Mise à jour de l’abonnement impossible." },
        { status: 500 }
      );

    if (updated?.status === "SUCCEEDED") {
      const { error: companyError } = await admin
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

      if (companyError)
        return NextResponse.json(
          {
            error:
              "Paiement confirmé, mais l’activation de l’abonnement doit être rejouée.",
          },
          { status: 500 }
        );

      await issueAffiliateCommission(
        admin,
        updated.tenant_id,
        updated.id,
        updated.amount
      );
    }

    return NextResponse.json({ payment: updated ?? payment, providerStatus });
  } catch (cause) {
    if (cause instanceof PawaPayError)
      return NextResponse.json({ error: cause.message }, { status: cause.status });
    if (cause instanceof MtnMomoError)
      return NextResponse.json({ error: cause.message }, { status: cause.status });
    return NextResponse.json(
      { error: "Impossible de vérifier le statut de l’abonnement." },
      { status: 502 }
    );
  }
}
