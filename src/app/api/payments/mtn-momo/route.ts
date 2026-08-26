// DebitManager MTN MoMo Collection: crée une demande asynchrone et ne déclare jamais la vente comme payée avant confirmation.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { MtnMomoError, requestToPay } from "@/lib/mtn-momo";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; orderId?: string; amount?: number; mobileNumber?: string };
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const mobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber.trim() : "";
    const requestedAmount = Number(body.amount);
    if (!tenantId || !orderId || !Number.isInteger(requestedAmount) || requestedAmount <= 0 || !mobileNumber) return NextResponse.json({ error: "Établissement, commande, numéro MTN MoMo et montant positif requis." }, { status: 400 });

    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "payments.create")) return NextResponse.json({ error: "Permission insuffisante pour préparer un encaissement." }, { status: 403 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });

    const { data: order, error: orderError } = await supabase.from("orders").select("id,tenant_id,server_user_id,order_number,total_amount,currency,status").eq("id", orderId).eq("tenant_id", tenantId).maybeSingle();
    if (orderError || !order) return NextResponse.json({ error: "Commande introuvable dans cet établissement." }, { status: 404 });
    if (context.role === "SERVEUR" && order.server_user_id !== user.id) return NextResponse.json({ error: "Cette commande ne vous est pas attribuée." }, { status: 403 });
    if (order.total_amount <= 0) return NextResponse.json({ error: "Le montant de la commande doit être positif." }, { status: 400 });

    const { data: existingPayments } = await supabase.from("payments").select("id,tenant_id,order_id,provider,status,amount,currency,provider_reference,paid_at,created_at").eq("order_id", order.id).eq("tenant_id", tenantId).in("status", ["SUCCEEDED", "PENDING", "PROCESSING"]);
    const alreadyCounted = (existingPayments ?? []).filter((payment) => payment.status === "SUCCEEDED").reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const remainingAmount = Number(order.total_amount) - alreadyCounted;
    if (requestedAmount > remainingAmount) return NextResponse.json({ error: "Le montant dépasse le reste à encaisser." }, { status: 409 });

    const existingPending = (existingPayments ?? []).find((payment) => payment.provider === "MTN_MOMO" && ["PENDING", "PROCESSING"].includes(payment.status) && Number(payment.amount) === requestedAmount && payment.provider_reference);
    if (existingPending) return NextResponse.json({ payment: existingPending, status: "PENDING", referenceId: existingPending.provider_reference });

    const { data: payment, error: paymentError } = await supabase.from("payments").insert({ tenant_id: tenantId, order_id: order.id, provider: "MTN_MOMO", payment_method: "MOBILE_MONEY", status: "PENDING", amount: requestedAmount, currency: order.currency || "XOF" }).select("id,tenant_id,order_id,provider,status,amount,currency,provider_reference,paid_at,created_at").single();
    if (paymentError || !payment) return NextResponse.json({ error: "Impossible de préparer le paiement MTN MoMo." }, { status: 400 });

    try {
      const initiated = await requestToPay({ amount: requestedAmount, currency: order.currency || "XOF", customerPhone: mobileNumber, externalId: payment.id, payerMessage: `Commande ${order.order_number}`, payeeNote: `DebitManager ${order.order_number}` });
      const { data: updatedPayment, error: referenceError } = await supabase.from("payments").update({ provider_reference: initiated.referenceId, updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", tenantId).select("id,tenant_id,order_id,provider,status,amount,currency,provider_reference,paid_at,created_at").single();
      if (referenceError || !updatedPayment) return NextResponse.json({ error: "Paiement initié mais référence locale incomplète. Vérifiez le statut avant une nouvelle tentative." }, { status: 500 });
      return NextResponse.json({ payment: updatedPayment, status: "PENDING", referenceId: initiated.referenceId });
    } catch (cause) {
      await supabase.from("payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", tenantId).eq("status", "PENDING");
      if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
      return NextResponse.json({ error: "MTN MoMo n’a pas pu initialiser le paiement." }, { status: 502 });
    }
  } catch (cause) {
    if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    return NextResponse.json({ error: "Impossible de préparer le paiement MTN MoMo." }, { status: 500 });
  }
}
