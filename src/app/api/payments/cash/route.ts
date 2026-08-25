// DebitManager cash payment: le règlement est possible avant préparation ou livraison, mais la vente et le stock sont finalisés au paiement total.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const amount = Number(body.amount);
    if (!tenantId || !orderId || !Number.isInteger(amount) || amount <= 0) return NextResponse.json({ error: "Établissement, commande et montant positif requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "payments.create")) return NextResponse.json({ error: "Permission insuffisante pour encaisser." }, { status: 403 });
    const { data: order } = await context.supabase.from("orders").select("id,tenant_id,server_user_id,status,total_amount,currency").eq("id", orderId).eq("tenant_id", tenantId).maybeSingle();
    if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (context.role === "SERVEUR" && order.server_user_id !== context.user.id) return NextResponse.json({ error: "Cette commande ne vous est pas attribuée." }, { status: 403 });
    const { data: payment, error } = await context.supabase.rpc("record_cash_payment", { p_order_id: order.id, p_amount: amount });
    if (error || !payment) {
      const messages: Record<string, string> = { PAYMENT_EXCEEDS_REMAINING: "Le montant dépasse le reste à encaisser.", ORDER_ALREADY_PAID: "Cette commande est déjà totalement payée.", ORDER_SERVER_ONLY: "Cette commande n’est pas attribuée au compte Serveur connecté.", COUNTER_STORE_NOT_FOUND: "Le magasin comptoir de l’établissement est introuvable.", INSUFFICIENT_COUNTER_STOCK: "Le stock comptoir est insuffisant pour finaliser cette vente.", AUTHENTICATION_REQUIRED: "La session de la Serveuse a expiré.", SERVER_REQUIRED: "Le compte connecté n’est pas reconnu comme Serveur actif.", INVALID_PAYMENT_AMOUNT: "Le montant espèces est invalide.", ORDER_NOT_FOUND: "Commande introuvable.", PAYMENT_INCOMPLETE: "Le paiement total de la facture est incomplet." };
      const errorCode = error?.message ?? "UNKNOWN_CASH_PAYMENT_ERROR";
      return NextResponse.json({ error: messages[errorCode] ?? `Encaissement refusé (${errorCode}).`, code: errorCode }, { status: 409 });
    }
    const { data: payments } = await context.supabase.from("payments").select("amount,status,payment_method").eq("order_id", order.id).eq("tenant_id", tenantId).in("status", ["PAID", "SUCCESS"]);
    const paidAmount = (payments ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    return NextResponse.json({ payment, paidAmount, remainingAmount: Math.max(order.total_amount - paidAmount, 0), isPaid: paidAmount >= order.total_amount }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
