// API serveur de certification DGI Bénin (e-MECeF) pour commande / facture
// Conforme à AGENTS.md : calculs et sécurisation effectués côté serveur.

import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { getCompanyDgiSettings, certifyNormalizedInvoice, DgiItemLine, DgiPaymentLine } from "@/lib/dgi-benin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      tenantId?: string;
      orderId?: string;
    } | null;

    const tenantId = body?.tenantId || "";
    const orderId = body?.orderId || "";

    if (!tenantId || !orderId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement ou commande non valide." }, { status: 400 });
    }

    // 1. Récupérer les paramètres DGI de l'établissement
    const dgiSettings = await getCompanyDgiSettings(context.supabase, tenantId);

    if (!dgiSettings.isNormalizedInvoiceEnabled) {
      return NextResponse.json({
        isNormalized: false,
        message: "Facturation normalisée désactivée pour cet établissement.",
      });
    }

    // 2. Récupérer la commande avec ses lignes et paiements
    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .select(`
        id,
        order_number,
        total_amount,
        created_at,
        customers (full_name, ifu, phone),
        order_items (id, product_name, quantity, unit_price, total_price, fulfillment_unit),
        payments (id, amount, payment_method, provider, status)
      `)
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const customerObj = Array.isArray(order.customers) ? order.customers[0] : order.customers;

    // Déterminer les lignes d'articles avec groupe de taxe DGI (par défaut Groupe B: TVA 18% pour restauration/boissons)
    const items: DgiItemLine[] = (order.order_items || []).map((item) => ({
      name: item.product_name,
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unit_price) || 0,
      totalPrice: Number(item.total_price) || 0,
      taxGroup: "B", // Restauration, boissons et services = Groupe B (18%) standard
    }));

    // Déterminer les lignes de paiement
    const validPayments = (order.payments || []).filter((p) => p.status === "SUCCEEDED");
    const payments: DgiPaymentLine[] = validPayments.length
      ? validPayments.map((p) => ({
          mode: p.provider === "CASH" || p.payment_method === "CASH" ? "E" : "M",
          amount: Number(p.amount) || 0,
        }))
      : [{ mode: "E", amount: Number(order.total_amount) || 0 }];

    // 3. Certifier avec la DGI du Bénin
    const certification = await certifyNormalizedInvoice(
      {
        ifu: dgiSettings.ifuNumber || "0202262507819",
        invoiceNumber: order.order_number,
        clientName: customerObj?.full_name || "Client comptoir",
        clientIfu: customerObj?.ifu || undefined,
        clientPhone: customerObj?.phone || undefined,
        items,
        payments,
      },
      {
        nim: dgiSettings.dgiNim,
        env: dgiSettings.dgiEnv,
        apiToken: dgiSettings.dgiApiToken,
      }
    );

    return NextResponse.json({
      isNormalized: true,
      certification,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la certification DGI." },
      { status: 500 }
    );
  }
}
