import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { resolvePaymentStatus, type CouturePaymentMethod } from "@/lib/couture-sales";

const validPaymentMethods: CouturePaymentMethod[] = ["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id: saleId } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sales.create");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const amountXof = Math.max(0, Math.floor(Number(body.amountXof) || 0));
    if (amountXof <= 0) {
      return NextResponse.json({ error: "Montant de règlement invalide." }, { status: 400 });
    }

    const paymentMethod: CouturePaymentMethod = validPaymentMethods.includes(body.paymentMethod)
      ? body.paymentMethod
      : "CASH";
    const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 120) : null;

    const admin = createSupabaseAdminClient();

    // Récupérer la vente
    const { data: sale, error: fetchErr } = await admin
      .from("couture_sales")
      .select("id, site_id, total_amount_xof, paid_amount_xof, balance_amount_xof, status")
      .eq("id", saleId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (fetchErr || !sale) {
      return NextResponse.json({ error: "Vente introuvable." }, { status: 404 });
    }

    if (sale.balance_amount_xof <= 0 || sale.status === "PAID") {
      return NextResponse.json({ error: "Cette vente est déjà intégralement soldée." }, { status: 400 });
    }

    const effectiveAmount = Math.min(amountXof, sale.balance_amount_xof);
    const newPaidAmount = sale.paid_amount_xof + effectiveAmount;
    const newBalance = Math.max(0, sale.total_amount_xof - newPaidAmount);
    const newStatus = resolvePaymentStatus(sale.total_amount_xof, newPaidAmount);

    // Insertion du paiement
    const { data: payment, error: payErr } = await admin
      .from("couture_sale_payments")
      .insert({
        tenant_id: context.tenantId,
        sale_id: saleId,
        site_id: sale.site_id,
        payment_method: paymentMethod,
        amount_xof: effectiveAmount,
        reference,
        received_by: context.user.id,
      })
      .select()
      .single();

    if (payErr || !payment) {
      return NextResponse.json({ error: "Impossible d'enregistrer le règlement." }, { status: 500 });
    }

    // Mise à jour de la vente
    const { data: updatedSale, error: updateErr } = await admin
      .from("couture_sales")
      .update({
        paid_amount_xof: newPaidAmount,
        balance_amount_xof: newBalance,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", saleId)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: "Erreur lors de la mise à jour des totaux de vente." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.sale.payment",
      entityType: "couture_sales",
      entityId: saleId,
      metadata: {
        paymentId: payment.id,
        paymentMethod,
        amountXof: effectiveAmount,
        newPaidAmount,
        newBalance,
        newStatus,
      },
    });

    return NextResponse.json({
      payment,
      sale: updatedSale,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
