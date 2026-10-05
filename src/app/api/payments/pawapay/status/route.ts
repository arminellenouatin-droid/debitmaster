// DebitMaster PawaPay POS Status: vérification du statut d'un encaissement de commande.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDepositStatus, PawaPayError } from "@/lib/pawapay";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) {
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 }
      );
    }

    const paymentId = new URL(request.url).searchParams.get("paymentId") ?? "";
    if (!paymentId) {
      return NextResponse.json(
        { error: "Identifiant de paiement requis." },
        { status: 400 }
      );
    }

    const { data: payment, error } = await context.supabase
      .from("payments")
      .select(
        "id,tenant_id,order_id,status,amount,currency,provider,provider_reference,paid_at"
      )
      .eq("id", paymentId)
      .maybeSingle();

    if (error || !payment) {
      return NextResponse.json(
        { error: "Paiement introuvable." },
        { status: 404 }
      );
    }

    if (!context.tenantIds.includes(payment.tenant_id)) {
      return NextResponse.json(
        { error: "Paiement non autorisé." },
        { status: 403 }
      );
    }

    if (
      ["SUCCEEDED", "FAILED", "REFUNDED"].includes(payment.status) ||
      !payment.provider_reference
    ) {
      return NextResponse.json({ payment, providerStatus: payment.status });
    }

    try {
      const check = await getDepositStatus(
        payment.provider_reference || payment.id
      );
      const providerStatus = check.status;

      let nextStatus: "SUCCEEDED" | "FAILED" | "PENDING" = "PENDING";
      if (check.status === "COMPLETED") {
        nextStatus = "SUCCEEDED";
      } else if (["FAILED", "REJECTED"].includes(check.status)) {
        nextStatus = "FAILED";
      }

      if (nextStatus === "PENDING") {
        return NextResponse.json({ payment, providerStatus });
      }

      const admin = createSupabaseAdminClient();
      const now = new Date().toISOString();
      const { data: updated } = await admin
        .from("payments")
        .update({
          status: nextStatus,
          paid_at: nextStatus === "SUCCEEDED" ? now : null,
          updated_at: now,
        })
        .eq("id", payment.id)
        .eq("status", payment.status)
        .select(
          "id,tenant_id,order_id,status,amount,currency,provider,provider_reference,paid_at"
        )
        .maybeSingle();

      if (updated?.status === "SUCCEEDED") {
        await admin.rpc("settle_order_stock_after_payment", {
          p_order_id: updated.order_id,
        });
        await admin
          .from("orders")
          .update({ payment_status: "PAID", updated_at: now })
          .eq("id", updated.order_id);
      }

      return NextResponse.json({
        payment: updated ?? payment,
        providerStatus,
      });
    } catch (checkErr) {
      return NextResponse.json({ payment, providerStatus: payment.status });
    }
  } catch (cause) {
    if (cause instanceof PawaPayError) {
      return NextResponse.json(
        { error: cause.message },
        { status: cause.status }
      );
    }
    return NextResponse.json(
      { error: "Impossible de vérifier le paiement." },
      { status: 502 }
    );
  }
}
