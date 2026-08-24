// DebitManager Moneroo initialization: server-only secret, tenant authorization, and pending payment record before redirect.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

const monerooApiUrl = "https://api.moneroo.io/v1/payments/initialize";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const mobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber.trim().slice(0, 24) : "";
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase().slice(0, 2) : "BJ";
    if (!tenantId || !orderId) return NextResponse.json({ error: "Établissement et commande requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "payments.create")) return NextResponse.json({ error: "Permission insuffisante pour préparer un encaissement." }, { status: 403 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const apiKey = process.env.MONEROO_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Moneroo n’est pas encore configuré sur le serveur." }, { status: 503 });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (!appUrl) return NextResponse.json({ error: "URL publique de retour Moneroo absente." }, { status: 503 });
    const { data: order, error: orderError } = await supabase.from("orders").select("id,tenant_id,server_user_id,order_number,total_amount,currency,status").eq("id", orderId).eq("tenant_id", tenantId).maybeSingle();
    if (orderError || !order) return NextResponse.json({ error: "Commande introuvable dans cet établissement." }, { status: 404 });
    if (context.role === "SERVEUR" && order.server_user_id !== user.id) return NextResponse.json({ error: "Cette commande ne vous est pas attribuée." }, { status: 403 });
    if (!["HANDED_OFF", "DELIVERED"].includes(order.status)) return NextResponse.json({ error: "La commande doit être remise ou livrée avant paiement." }, { status: 409 });
    if (order.total_amount <= 0) return NextResponse.json({ error: "Le montant de la commande doit être positif." }, { status: 400 });
    const { data: payment, error: paymentError } = await supabase.from("payments").insert({ tenant_id: tenantId, order_id: order.id, provider: "MONEROO", payment_method: "MOBILE_MONEY", status: "PENDING", amount: order.total_amount, currency: order.currency }).select("id,tenant_id,order_id,provider,status,amount,currency,provider_reference,paid_at,created_at").single();
    if (paymentError || !payment) return NextResponse.json({ error: "Impossible de préparer le paiement." }, { status: 400 });
    const monerooPayload: Record<string, unknown> = { amount: order.total_amount, currency: order.currency, description: `Commande ${order.order_number}`, return_url: `${appUrl}/dashboard/payment?orderId=${encodeURIComponent(order.id)}`, customer: { email: user.email ?? "", first_name: user.user_metadata?.first_name ?? "", last_name: user.user_metadata?.last_name ?? "" }, metadata: { order_id: order.id, tenant_id: tenantId, payment_id: payment.id } };
    if (mobileNumber) monerooPayload.restricted_phone = { number: mobileNumber, country_code: countryCode };
    const monerooResponse = await fetch(monerooApiUrl, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(monerooPayload) });
    const monerooResult = await monerooResponse.json().catch(() => null) as { data?: { id?: string; checkout_url?: string }; message?: string } | null;
    if (!monerooResponse.ok || !monerooResult?.data?.id || !monerooResult.data.checkout_url) { await supabase.from("payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", tenantId); return NextResponse.json({ error: monerooResult?.message ?? "Moneroo n’a pas pu initialiser le paiement." }, { status: 502 }); }
    const { data: updatedPayment, error: referenceError } = await supabase.from("payments").update({ provider_reference: monerooResult.data.id, updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", tenantId).select("id,tenant_id,order_id,provider,status,amount,currency,provider_reference,paid_at,created_at").single();
    if (referenceError || !updatedPayment) return NextResponse.json({ error: "Paiement initialisé mais référence locale incomplète. Contactez le support avant une nouvelle tentative." }, { status: 500 });
    return NextResponse.json({ payment: updatedPayment, checkoutUrl: monerooResult.data.checkout_url });
  } catch {
    return NextResponse.json({ error: "Impossible de préparer le paiement Moneroo." }, { status: 500 });
  }
}
