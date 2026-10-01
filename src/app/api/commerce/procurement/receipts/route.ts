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

    const { data: receipts, error: recErr } = await admin
      .from("goods_receipts")
      .select(`
        id, receipt_number, purchase_order_id, supplier_id, store_id, supplier_invoice_ref,
        status, landed_costs_applied_xof, notes, received_at, created_at,
        goods_receipt_items (
          id, product_id, product_name, quantity_received, unit_cost_xof, total_cost_xof
        )
      `)
      .eq("tenant_id", context.tenantId)
      .order("received_at", { ascending: false })
      .limit(100);

    if (recErr) {
      console.error("[procurement/receipts.GET] error", recErr);
      return NextResponse.json({ error: "Impossible de récupérer les bons de réception." }, { status: 500 });
    }

    return NextResponse.json({ receipts: receipts || [] });
  } catch (err) {
    console.error("[procurement/receipts.GET] unexpected error", err);
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
      purchaseOrderId,
      storeId,
      supplierInvoiceRef,
      landedCostsAppliedXof = 0,
      notes,
      items,
    } = body;

    if (!purchaseOrderId || !storeId) {
      return NextResponse.json({ error: "Le bon de commande et le magasin de réception sont obligatoires." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "La réception doit comporter au moins un article." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Vérifier la commande fournisseur
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select(`
        id, order_number, supplier_id, status,
        purchase_order_items ( id, product_id, quantity_ordered, quantity_received, unit_price_xof )
      `)
      .eq("id", purchaseOrderId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (poErr || !po) {
      return NextResponse.json({ error: "Bon de commande fournisseur introuvable." }, { status: 404 });
    }

    // 2. Générer le numéro séquentiel BR
    let receiptNumber: string;
    try {
      const { data: numData, error: numErr } = await admin.rpc("next_document_number", {
        p_tenant_id: context.tenantId,
        p_doc_type: "GOODS_RECEIPT",
      });
      if (numErr || !numData) {
        receiptNumber = `BR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      } else {
        receiptNumber = numData;
      }
    } catch {
      receiptNumber = `BR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }

    const now = new Date().toISOString();

    // 3. Créer l'enregistrement de bon de réception
    const { data: createdReceipt, error: createErr } = await admin
      .from("goods_receipts")
      .insert({
        tenant_id: context.tenantId,
        receipt_number: receiptNumber,
        purchase_order_id: po.id,
        supplier_id: po.supplier_id,
        store_id: storeId,
        supplier_invoice_ref: supplierInvoiceRef ? String(supplierInvoiceRef).trim() : null,
        received_by_user_id: context.user.id,
        status: "CONFIRMED",
        landed_costs_applied_xof: Math.max(0, Math.round(Number(landedCostsAppliedXof) || 0)),
        notes: notes ? String(notes).trim() : null,
        received_at: now,
      })
      .select()
      .single();

    if (createErr || !createdReceipt) {
      console.error("[procurement/receipts.POST] insert failed", createErr);
      return NextResponse.json({ error: "Impossible de créer le bon de réception." }, { status: 500 });
    }

    // 4. Traiter chaque article reçu :
    //    - insertion dans goods_receipt_items
    //    - incrément de quantity_received sur purchase_order_items
    //    - incrément de stock physique sur store_inventory
    //    - recalcul du CMP sur commerce_products
    //    - écriture du mouvement dans stock_movements
    const receiptItemsToInsert = [];

    for (const item of items) {
      const qtyReceived = Math.max(0, Number(item.quantityReceived) || 0);
      if (qtyReceived <= 0) continue;

      const unitCost = Math.max(0, Math.round(Number(item.unitCostXof) || 0));
      const totalCost = qtyReceived * unitCost;

      receiptItemsToInsert.push({
        tenant_id: context.tenantId,
        goods_receipt_id: createdReceipt.id,
        product_id: item.productId,
        product_name: String(item.productName || "Article").trim(),
        quantity_received: qtyReceived,
        unit_cost_xof: unitCost,
        total_cost_xof: totalCost,
      });

      // Mettre à jour purchase_order_items
      if (item.purchaseOrderItemId) {
        const poItem = (po.purchase_order_items || []).find((p: any) => p.id === item.purchaseOrderItemId);
        if (poItem) {
          const newQtyRec = (Number(poItem.quantity_received) || 0) + qtyReceived;
          await admin
            .from("purchase_order_items")
            .update({ quantity_received: newQtyRec })
            .eq("id", poItem.id);
        }
      }

      // Mettre à jour store_inventory
      const { data: invRow } = await admin
        .from("store_inventory")
        .select("id, current_stock")
        .eq("store_id", storeId)
        .eq("product_id", item.productId)
        .maybeSingle();

      const prevStock = Number(invRow?.current_stock) || 0;
      const nextStock = prevStock + qtyReceived;

      if (invRow) {
        await admin
          .from("store_inventory")
          .update({ current_stock: nextStock, updated_at: now })
          .eq("id", invRow.id);
      } else {
        await admin.from("store_inventory").insert({
          tenant_id: context.tenantId,
          store_id: storeId,
          product_id: item.productId,
          current_stock: nextStock,
          updated_at: now,
        });
      }

      // Recalcul du CMP (Coût Moyen Pondéré) sur commerce_products
      const { data: prod } = await admin
        .from("commerce_products")
        .select("weighted_avg_cost_xof")
        .eq("id", item.productId)
        .eq("tenant_id", context.tenantId)
        .maybeSingle();

      if (prod) {
        const prevCmp = Number(prod.weighted_avg_cost_xof) || unitCost;
        let newCmp = unitCost;
        if (nextStock > 0 && prevStock > 0) {
          newCmp = Math.round(((prevStock * prevCmp) + (qtyReceived * unitCost)) / nextStock);
        }
        await admin
          .from("commerce_products")
          .update({ weighted_avg_cost_xof: newCmp, purchase_price_xof: unitCost, updated_at: now })
          .eq("id", item.productId);
      }

      // Enregistrer le mouvement de stock
      await admin.from("stock_movements").insert({
        tenant_id: context.tenantId,
        store_id: storeId,
        product_id: item.productId,
        movement_type: "PURCHASE_RECEIPT",
        quantity: qtyReceived,
        reference: receiptNumber,
        notes: `Réception fournisseur ${receiptNumber} (Commande ${po.order_number}) - Fournisseur ${supplierInvoiceRef || "Direct"}`,
      });
    }

    if (receiptItemsToInsert.length > 0) {
      await admin.from("goods_receipt_items").insert(receiptItemsToInsert);
    }

    // 5. Mettre à jour le statut global du Bon de commande (PARTIALLY_RECEIVED ou RECEIVED)
    const { data: updatedPoItems } = await admin
      .from("purchase_order_items")
      .select("quantity_ordered, quantity_received")
      .eq("purchase_order_id", po.id);

    let totalOrdered = 0;
    let totalRec = 0;
    for (const line of updatedPoItems || []) {
      totalOrdered += Number(line.quantity_ordered) || 0;
      totalRec += Number(line.quantity_received) || 0;
    }

    let poStatus = "PARTIALLY_RECEIVED";
    if (totalRec >= totalOrdered && totalOrdered > 0) {
      poStatus = "RECEIVED";
    }

    await admin
      .from("purchase_orders")
      .update({ status: poStatus, updated_at: now })
      .eq("id", po.id);

    return NextResponse.json({
      success: true,
      receipt: createdReceipt,
      poStatus,
      message: `Bon de réception ${receiptNumber} enregistré. Stock physique crédité et CMP mis à jour.`,
    });
  } catch (err) {
    console.error("[procurement/receipts.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
