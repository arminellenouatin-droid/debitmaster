// DebitManager cash payment: l’encaissement est autorisé uniquement sur une commande livrée par son serveur.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!tenantId || !orderId) return NextResponse.json({ error: "Établissement et commande requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "payments.create")) return NextResponse.json({ error: "Permission insuffisante pour encaisser." }, { status: 403 });
    const { data: order } = await context.supabase.from("orders").select("id,tenant_id,server_user_id,status,total_amount,currency").eq("id", orderId).eq("tenant_id", tenantId).maybeSingle();
    if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (context.role === "SERVEUR" && order.server_user_id !== context.user.id) return NextResponse.json({ error: "Cette commande ne vous est pas attribuée." }, { status: 403 });
    if (!["HANDED_OFF", "DELIVERED"].includes(order.status)) return NextResponse.json({ error: "La commande doit être remise ou livrée avant encaissement." }, { status: 409 });
    const { data: payment, error } = await context.supabase.rpc("record_cash_payment_and_settle", { p_order_id: order.id });
    if (error || !payment) return NextResponse.json({ error: error?.message === "PAYMENT_ALREADY_RECORDED" ? "La commande est déjà encaissée." : "Impossible de confirmer le paiement et de solder les articles affectés." }, { status: 409 });
    return NextResponse.json({ payment }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
