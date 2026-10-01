// DebitMaster Commerce API: conversion d'un devis en commande/facture "À régler" avec réservation de stock
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const admin = createSupabaseAdminClient();

    // 1. Récupérer le devis et ses lignes
    const { data: quote, error: quoteError } = await admin
      .from("quotes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Devis introuvable." }, { status: 404 });
    }

    if (!context.tenantIds.includes(quote.tenant_id)) {
      return NextResponse.json({ error: "Accès refusé à ce devis." }, { status: 403 });
    }

    if (quote.status === "CONVERTED") {
      return NextResponse.json({ error: "Ce devis a déjà été converti en facture." }, { status: 400 });
    }

    if (!can(context, "quotes.convert") && !can(context, "orders.create")) {
      return NextResponse.json({ error: "Permission insuffisante pour convertir le devis." }, { status: 403 });
    }

    const { data: items, error: itemsError } = await admin
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id);

    if (itemsError || !items || items.length === 0) {
      return NextResponse.json({ error: "Le devis ne contient aucun article." }, { status: 400 });
    }

    // 2. Générer le numéro de facture séquentiel (FAC-YYYY-XXXXXX)
    const year = new Date().getFullYear();
    let invoiceNumber = "";
    try {
      const { data: numData } = await admin.rpc("next_document_number", {
        p_tenant_id: quote.tenant_id,
        p_doc_type: "INVOICE",
      });
      if (numData) invoiceNumber = String(numData);
    } catch {
      // Fallback
    }

    if (!invoiceNumber) {
      const { count } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", quote.tenant_id);
      const seq = (count ?? 0) + 1;
      invoiceNumber = `FAC-${year}-${String(seq).padStart(6, "0")}`;
    }

    const sellerName = [context.user.user_metadata?.first_name, context.user.user_metadata?.last_name]
      .filter(Boolean)
      .join(" ") || quote.seller_name || "Vendeur";

    // 3. Créer la commande / facture en statut PENDING ("À régler" en caisse)
    const orderPayload: Record<string, unknown> = {
      tenant_id: quote.tenant_id,
      order_number: invoiceNumber,
      invoice_number: invoiceNumber,
      document_type: "INVOICE",
      table_label: quote.customer_name ? `Client: ${quote.customer_name}` : "Vente comptoir",
      server_name: sellerName,
      server_user_id: context.user.id,
      customer_id: quote.customer_id,
      total_amount: Number(quote.total_amount),
      currency: quote.currency || "XOF",
      status: "PENDING", // En attente de paiement en caisse
      discount_amount: Number(quote.discount_amount) || 0,
      tax_amount: Number(quote.tax_amount) || 0,
      quote_id: quote.id,
    };

    const { data: createdOrder, error: orderError } = await admin
      .from("orders")
      .insert(orderPayload)
      .select()
      .single();

    if (orderError || !createdOrder) {
      return NextResponse.json({ error: orderError?.message || "Impossible de créer la facture." }, { status: 400 });
    }

    // 4. Insérer les lignes dans order_items
    const orderItemsToInsert = items.map((item) => ({
      tenant_id: quote.tenant_id,
      order_id: createdOrder.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
      fulfillment_unit: "COUNTER",
      preparation_status: "PENDING",
    }));

    const { data: insertedOrderItems, error: orderItemsError } = await admin
      .from("order_items")
      .insert(orderItemsToInsert)
      .select();

    if (orderItemsError) {
      console.error("[DebitMaster] Error inserting order items on conversion:", orderItemsError);
    }

    // 5. Réserver le stock pour chaque article (order_stock_allocations)
    if (insertedOrderItems && insertedOrderItems.length > 0) {
      const stockAllocations = insertedOrderItems.map((oi) => ({
        tenant_id: quote.tenant_id,
        order_id: createdOrder.id,
        order_item_id: oi.id,
        product_id: oi.product_id,
        server_user_id: context.user.id,
        quantity: oi.quantity,
        status: "ALLOCATED", // Réservé pour la vente
      }));

      const { error: allocError } = await admin
        .from("order_stock_allocations")
        .insert(stockAllocations);

      if (allocError) {
        console.error("[DebitMaster] Error reserving stock on conversion:", allocError);
      }
    }

    // 6. Mettre à jour le statut du devis en CONVERTED
    await admin
      .from("quotes")
      .update({
        status: "CONVERTED",
        converted_order_id: createdOrder.id,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.id);

    return NextResponse.json({
      success: true,
      orderId: createdOrder.id,
      invoiceNumber,
      message: `Devis converti avec succès. Facture ${invoiceNumber} transmise à la caisse.`,
    });
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
