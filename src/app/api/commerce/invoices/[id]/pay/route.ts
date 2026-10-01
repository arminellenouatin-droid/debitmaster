import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    // Le vendeur ne peut PAS encaisser (Séparation stricte des tâches)
    if (context.role === "VENDEUR") {
      return NextResponse.json(
        { error: "Séparation stricte des tâches : le Vendeur n'est pas autorisé à encaisser les paiements. Cette action est réservée au Caissier ou au Promoteur." },
        { status: 403 }
      );
    }

    const { id: orderId } = await params;
    const body = await request.json();

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : null;
    const paymentsInput = Array.isArray(body.payments) ? body.payments : [
      {
        method: body.paymentMethod,
        amount: body.amount,
        reference: body.transactionReference,
      }
    ];

    if (!paymentsInput.length) {
      return NextResponse.json({ error: "Aucun règlement spécifié." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Charger la commande / facture
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, tenant_id, total_amount, amount_paid, payment_status, status, invoice_number")
      .eq("id", orderId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Facture / commande introuvable." }, { status: 404 });
    }

    if (order.payment_status === "PAID") {
      return NextResponse.json({ error: "Cette facture est déjà intégralement payée." }, { status: 400 });
    }

    const totalOrderAmount = Number(order.total_amount) || 0;
    const currentPaid = Number(order.amount_paid) || 0;
    const remainingToPay = Math.max(0, totalOrderAmount - currentPaid);

    let incomingPaymentTotal = 0;
    const recordsToInsert = [];

    const allowedMethods = ["CASH", "MTN_MOMO", "MOOV_MONEY", "ORANGE_MONEY", "WAVE", "CARD", "CHECK", "TRANSFER", "CREDIT"];

    for (const p of paymentsInput) {
      const method = String(p.method || "").toUpperCase();
      const amt = Math.floor(Number(p.amount) || 0);
      const ref = typeof p.reference === "string" ? p.reference.trim() : null;

      if (!allowedMethods.includes(method)) {
        return NextResponse.json({ error: `Mode de règlement invalide : ${method}` }, { status: 400 });
      }
      if (amt <= 0) {
        return NextResponse.json({ error: "Chaque versement doit être supérieur à 0 FCFA." }, { status: 400 });
      }

      incomingPaymentTotal += amt;
      recordsToInsert.push({
        tenant_id: context.tenantId,
        order_id: orderId,
        session_id: sessionId || null,
        cashier_user_id: context.user.id,
        payment_method: method,
        amount: amt,
        currency: "XOF",
        transaction_reference: ref,
      });
    }

    // 2. Insérer les paiements
    const { error: insertErr } = await admin.from("order_payments").insert(recordsToInsert);
    if (insertErr) {
      console.error("[invoices.pay] payment insert failed", insertErr);
      return NextResponse.json({ error: "Erreur lors de l'enregistrement du règlement." }, { status: 500 });
    }

    // 3. Mettre à jour le solde et statut de la facture
    const newTotalPaid = currentPaid + incomingPaymentTotal;
    const isFullyPaid = newTotalPaid >= totalOrderAmount;
    const newPaymentStatus = isFullyPaid ? "PAID" : "PARTIALLY_PAID";
    const newOrderStatus = isFullyPaid ? "PAID" : order.status;

    const { data: updatedOrder, error: updateErr } = await admin
      .from("orders")
      .update({
        amount_paid: newTotalPaid,
        payment_status: newPaymentStatus,
        status: newOrderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateErr) {
      console.error("[invoices.pay] order update failed", updateErr);
      return NextResponse.json({ error: "Erreur lors de la mise à jour de la facture." }, { status: 500 });
    }

    // 4. Si une session de caisse est active, mettre à jour le solde de la session
    if (sessionId) {
      const { data: session } = await admin
        .from("cash_register_sessions")
        .select("total_collected, expected_cash, total_payments_count")
        .eq("id", sessionId)
        .single();

      if (session) {
        let cashAdd = 0;
        recordsToInsert.forEach((r) => {
          if (r.payment_method === "CASH") cashAdd += r.amount;
        });

        await admin
          .from("cash_register_sessions")
          .update({
            total_collected: (Number(session.total_collected) || 0) + incomingPaymentTotal,
            expected_cash: (Number(session.expected_cash) || 0) + cashAdd,
            total_payments_count: (Number(session.total_payments_count) || 0) + recordsToInsert.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      totalPaid: newTotalPaid,
      remainingAmount: Math.max(0, totalOrderAmount - newTotalPaid),
      isFullyPaid,
      receipt: {
        invoiceNumber: updatedOrder?.invoice_number || `COMM-${orderId.slice(0, 8)}`,
        totalAmount: totalOrderAmount,
        amountPaid: newTotalPaid,
        payments: recordsToInsert,
        cashierId: context.user.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (cause) {
    console.error("[invoices.pay] error", cause);
    return NextResponse.json({ error: "Erreur serveur lors du paiement." }, { status: 500 });
  }
}
