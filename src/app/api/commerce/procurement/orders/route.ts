import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const { data: orders, error: ordersErr } = await admin
      .from("purchase_orders")
      .select(`
        id, order_number, status, total_subtotal_xof, landed_costs_xof, total_tax_xof, total_amount_xof,
        payment_terms, expected_delivery_date, notes, created_at, approved_at, sent_at,
        supplier_id, store_id, purchase_request_id,
        purchase_order_items (
          id, product_id, product_name, quantity_ordered, quantity_received, unit_price_xof, tax_rate_basis_points, total_line_xof
        )
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (ordersErr) {
      console.error("[procurement/orders.GET] error", ordersErr);
      return NextResponse.json({ error: "Impossible de récupérer les commandes fournisseurs." }, { status: 500 });
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (err) {
    console.error("[procurement/orders.GET] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await request.json();
    const {
      supplierId,
      storeId,
      purchaseRequestId,
      expectedDeliveryDate,
      paymentTerms,
      landedCostsXof = 0,
      notes,
      items,
    } = body;

    if (!supplierId) {
      return NextResponse.json({ error: "Le fournisseur est obligatoire." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Le bon de commande doit comporter au moins un article." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Génération du numéro séquentiel BC
    let orderNumber: string;
    try {
      const { data: numData, error: numErr } = await admin.rpc("next_document_number", {
        p_tenant_id: context.tenantId,
        p_doc_type: "PURCHASE_ORDER",
      });
      if (numErr || !numData) {
        orderNumber = `BC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      } else {
        orderNumber = numData;
      }
    } catch {
      orderNumber = `BC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }

    let subtotalXof = 0;
    let totalTaxXof = 0;

    const itemsToInsert = items.map((item: any) => {
      const qty = Math.max(1, Number(item.quantityOrdered) || 1);
      const unitPrice = Math.max(0, Math.round(Number(item.unitPriceXof) || 0));
      const lineTaxRate = Number(item.taxRateBasisPoints) || 0;
      const lineSubtotal = qty * unitPrice;
      const lineTax = Math.round((lineSubtotal * lineTaxRate) / 10000);

      subtotalXof += lineSubtotal;
      totalTaxXof += lineTax;

      return {
        tenant_id: context.tenantId,
        product_id: item.productId,
        product_name: String(item.productName || "Article").trim(),
        quantity_ordered: qty,
        quantity_received: 0,
        unit_price_xof: unitPrice,
        tax_rate_basis_points: lineTaxRate,
        total_line_xof: lineSubtotal + lineTax,
      };
    });

    const parsedLandedCosts = Math.max(0, Math.round(Number(landedCostsXof) || 0));
    const totalAmountXof = subtotalXof + totalTaxXof + parsedLandedCosts;

    // Règle de validation selon seuil (ex: > 500 000 FCFA nécessite validation promoteur/gérant)
    const requiresApproval = totalAmountXof >= 500000;
    const initialStatus = requiresApproval ? "PENDING_APPROVAL" : "APPROVED";

    const { data: createdOrder, error: orderErr } = await admin
      .from("purchase_orders")
      .insert({
        tenant_id: context.tenantId,
        order_number: orderNumber,
        supplier_id: supplierId,
        store_id: storeId || null,
        purchase_request_id: purchaseRequestId || null,
        status: initialStatus,
        total_subtotal_xof: subtotalXof,
        landed_costs_xof: parsedLandedCosts,
        total_tax_xof: totalTaxXof,
        total_amount_xof: totalAmountXof,
        payment_terms: paymentTerms ? String(paymentTerms).trim() : null,
        expected_delivery_date: expectedDeliveryDate || null,
        notes: notes ? String(notes).trim() : null,
        created_by_user_id: context.user.id,
        approved_by_user_id: requiresApproval ? null : context.user.id,
        approved_at: requiresApproval ? null : new Date().toISOString(),
      })
      .select()
      .single();

    if (orderErr || !createdOrder) {
      console.error("[procurement/orders.POST] insert failed", orderErr);
      return NextResponse.json({ error: "Impossible d'enregistrer le bon de commande." }, { status: 500 });
    }

    const finalItems = itemsToInsert.map((it: any) => ({
      ...it,
      purchase_order_id: createdOrder.id,
    }));

    await admin.from("purchase_order_items").insert(finalItems);

    // Si issue d'une DA, la marquer convertie
    if (purchaseRequestId) {
      await admin
        .from("purchase_requests")
        .update({ status: "CONVERTED", updated_at: new Date().toISOString() })
        .eq("id", purchaseRequestId)
        .eq("tenant_id", context.tenantId);
    }

    return NextResponse.json({
      success: true,
      order: createdOrder,
      message: `Bon de commande ${orderNumber} enregistré avec succès (${requiresApproval ? "En attente de validation promoteur" : "Approuvé"}).`,
    });
  } catch (err) {
    console.error("[procurement/orders.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
