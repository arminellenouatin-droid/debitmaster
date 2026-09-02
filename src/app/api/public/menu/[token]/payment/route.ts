// Paiement QR public, Design Read: parcours lounge sans compte, mais contrôle serveur strict du jeton, de la table, de la commande et du montant avant tout appel Mobile Money.
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCollectionStatus, MtnMomoError, requestToPay } from "@/lib/mtn-momo";
import { loadTenantMtnMomoCredentials } from "@/lib/mtn-momo-credentials";
import { verifyPublicMenuToken } from "@/lib/public-menu-token";

type Context = { params: Promise<{ token: string }> };
const terminalProviderStatuses = new Set(["SUCCESSFUL", "FAILED", "REJECTED", "TIMEOUT", "CANCELLED"]);

async function resolve(token: string, orderId: string) {
  const payload = verifyPublicMenuToken(token);
  if (!payload) return null;
  const admin = createSupabaseAdminClient();
  const [{ data: table }, { data: order }] = await Promise.all([
    admin.from("dining_tables").select("id,label,tenant_id").eq("id", payload.tableId).eq("tenant_id", payload.tenantId).is("deleted_at", null).maybeSingle(),
    admin.from("orders").select("id,tenant_id,table_label,order_number,total_amount,currency,status").eq("id", orderId).eq("tenant_id", payload.tenantId).maybeSingle(),
  ]);
  if (!table || !order || order.table_label !== table.label) return null;
  return { payload, table, order, admin };
}

function localStatus(providerStatus: string) {
  return providerStatus === "SUCCESSFUL" ? "SUCCEEDED" : terminalProviderStatuses.has(providerStatus) ? "FAILED" : "PENDING";
}

export async function POST(request: Request, { params }: Context) {
  try {
    const body = await request.json() as { orderId?: unknown; amount?: unknown; mobileNumber?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const mobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber.trim() : "";
    const amount = Number(body.amount);
    if (!orderId || !Number.isInteger(amount) || amount <= 0 || !mobileNumber) return NextResponse.json({ error: "Commande, montant et numéro Mobile Money sont requis." }, { status: 400 });
    const resolved = await resolve((await params).token, orderId);
    if (!resolved) return NextResponse.json({ error: "Commande introuvable pour cette table." }, { status: 404 });
    const { admin, payload, order } = resolved;
    const { data: existing } = await admin.from("payments").select("id,status,amount,currency,provider,provider_reference,order_id").eq("tenant_id", payload.tenantId).eq("order_id", order.id).in("status", ["SUCCEEDED", "PENDING", "PROCESSING"]).limit(50);
    const succeeded = (existing ?? []).filter((payment) => payment.status === "SUCCEEDED").reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const remaining = Number(order.total_amount) - succeeded;
    if (remaining <= 0) return NextResponse.json({ error: "Cette commande est déjà réglée." }, { status: 409 });
    if (amount !== remaining) return NextResponse.json({ error: `Le paiement doit correspondre au solde de ${remaining.toLocaleString("fr-FR")} XOF.` }, { status: 409 });
    const pending = (existing ?? []).find((payment) => payment.provider === "MTN_MOMO" && ["PENDING", "PROCESSING"].includes(payment.status) && Number(payment.amount) === amount && payment.provider_reference);
    if (pending) return NextResponse.json({ payment: pending, status: "PENDING", referenceId: pending.provider_reference });
    const { data: payment, error: paymentError } = await admin.from("payments").insert({ tenant_id: payload.tenantId, order_id: order.id, provider: "MTN_MOMO", payment_method: "MOBILE_MONEY", status: "PENDING", amount, currency: order.currency || "XOF" }).select("id,tenant_id,order_id,provider,status,amount,currency,provider_reference,paid_at,created_at").single();
    if (paymentError || !payment) return NextResponse.json({ error: "Impossible de préparer le paiement Mobile Money." }, { status: 400 });
    try {
      const credentials = await loadTenantMtnMomoCredentials(admin, payload.tenantId);
      const initiated = await requestToPay({ amount, currency: order.currency || "XOF", customerPhone: mobileNumber, externalId: payment.id, payerMessage: `Commande ${order.order_number}`, payeeNote: `DebitManager ${order.order_number}`, credentials: credentials ?? undefined });
      const { data: updated, error: updateError } = await admin.from("payments").update({ provider_reference: initiated.referenceId, updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", payload.tenantId).select("id,tenant_id,order_id,provider,status,amount,currency,provider_reference,paid_at,created_at").single();
      if (updateError || !updated) return NextResponse.json({ error: "Paiement initié, mais sa référence locale est incomplète." }, { status: 500 });
      return NextResponse.json({ payment: updated, status: "PENDING", referenceId: initiated.referenceId });
    } catch (cause) {
      await admin.from("payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("tenant_id", payload.tenantId).eq("status", "PENDING");
      if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
      return NextResponse.json({ error: "Mobile Money n’a pas pu initialiser le paiement." }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Impossible de préparer le paiement." }, { status: 400 });
  }
}

export async function GET(request: Request, { params }: Context) {
  try {
    const orderId = new URL(request.url).searchParams.get("orderId") ?? "";
    const resolved = await resolve((await params).token, orderId);
    if (!resolved) return NextResponse.json({ error: "Commande introuvable pour cette table." }, { status: 404 });
    const paymentId = new URL(request.url).searchParams.get("paymentId") ?? "";
    const { admin, payload } = resolved;
    const { data: payment } = await admin.from("payments").select("id,tenant_id,order_id,status,amount,currency,provider,provider_reference,paid_at").eq("id", paymentId).eq("order_id", orderId).eq("tenant_id", payload.tenantId).maybeSingle();
    if (!payment || payment.provider !== "MTN_MOMO") return NextResponse.json({ error: "Paiement introuvable." }, { status: 404 });
    if (["SUCCEEDED", "FAILED", "REFUNDED"].includes(payment.status) || !payment.provider_reference) return NextResponse.json({ payment, providerStatus: payment.status });
    const credentials = await loadTenantMtnMomoCredentials(admin, payload.tenantId);
    const providerPayload = await getCollectionStatus(payment.provider_reference, credentials ?? undefined);
    const providerStatus = typeof providerPayload?.status === "string" ? providerPayload.status.toUpperCase() : "PENDING";
    const nextStatus = localStatus(providerStatus);
    if (nextStatus === "PENDING") return NextResponse.json({ payment, providerStatus });
    const now = new Date().toISOString();
    const { data: updated } = await admin.from("payments").update({ status: nextStatus, paid_at: nextStatus === "SUCCEEDED" ? now : null, updated_at: now }).eq("id", payment.id).eq("status", payment.status).select("id,tenant_id,order_id,status,amount,currency,provider,provider_reference,paid_at").maybeSingle();
    if (updated?.status === "SUCCEEDED") await admin.rpc("settle_order_stock_after_payment", { p_order_id: updated.order_id });
    return NextResponse.json({ payment: updated ?? payment, providerStatus });
  } catch (cause) {
    if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    return NextResponse.json({ error: "Impossible de vérifier le paiement." }, { status: 502 });
  }
}
