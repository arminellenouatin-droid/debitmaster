import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function GET() {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: returns, error } = await admin
      .from("customer_returns")
      .select(`
        id,
        return_number,
        order_id,
        customer_name,
        return_reason,
        total_refund_amount,
        status,
        created_at,
        customer_return_items(id, product_name, quantity, unit_price, total_price, condition)
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les retours." }, { status: 500 });
    }

    return NextResponse.json({ returns: returns ?? [] });
  } catch (cause) {
    console.error("[returns.GET] error", cause);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
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
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const storeId = typeof body.storeId === "string" ? body.storeId.trim() : null;
    const returnReason = typeof body.returnReason === "string" ? body.returnReason.trim() : "";
    const itemsInput = Array.isArray(body.items) ? body.items : [];

    if (!orderId) {
      return NextResponse.json({ error: "Identifiant de commande requis." }, { status: 400 });
    }
    if (!returnReason || returnReason.length < 3) {
      return NextResponse.json({ error: "Motif du retour obligatoire (min 3 caractères)." }, { status: 400 });
    }
    if (!itemsInput.length) {
      return NextResponse.json({ error: "Au moins un article retourné doit être sélectionné." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Vérifier la commande
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, tenant_id, customer_name, customer_id")
      .eq("id", orderId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (oErr || !order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    // 2. Générer le numéro séquentiel d'avoir AVR-YYYY-XXXXXX
    const { data: creditNoteNumber } = await admin.rpc("next_document_number", {
      p_tenant_id: context.tenantId,
      p_doc_type: "CREDIT_NOTE",
    });

    const returnNumber = `RET-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    let totalRefundAmount = 0;
    const returnItemsToInsert = [];

    for (const item of itemsInput) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const totalPrice = qty * unitPrice;
      const condition = item.condition === "SCRAPPED" ? "SCRAPPED" : "RESTOCKED";

      totalRefundAmount += totalPrice;
      returnItemsToInsert.push({
        product_id: item.productId,
        product_name: item.productName || "Article",
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        condition,
      });
    }

    // 3. Créer l'enregistrement de retour
    const { data: createdReturn, error: rErr } = await admin
      .from("customer_returns")
      .insert({
        tenant_id: context.tenantId,
        return_number: returnNumber,
        order_id: orderId,
        customer_id: order.customer_id,
        customer_name: order.customer_name || "Client comptoir",
        store_id: storeId,
        processed_by_user_id: context.user.id,
        status: "COMPLETED",
        return_reason: returnReason,
        total_refund_amount: totalRefundAmount,
      })
      .select()
      .single();

    if (rErr || !createdReturn) {
      console.error("[returns.POST] return insert failed", rErr);
      return NextResponse.json({ error: "Impossible d'enregistrer le retour client." }, { status: 500 });
    }

    // 4. Insérer les lignes de retour et réintégrer en stock si RESTOCKED
    for (const item of returnItemsToInsert) {
      await admin.from("customer_return_items").insert({
        tenant_id: context.tenantId,
        return_id: createdReturn.id,
        ...item,
      });

      if (item.condition === "RESTOCKED" && storeId && item.product_id) {
        const { data: stock } = await admin
          .from("store_inventory")
          .select("current_stock")
          .eq("store_id", storeId)
          .eq("product_id", item.product_id)
          .maybeSingle();

        if (stock) {
          await admin
            .from("store_inventory")
            .update({
              current_stock: (Number(stock.current_stock) || 0) + item.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq("store_id", storeId)
            .eq("product_id", item.product_id);
        }

        await admin.from("stock_movements").insert({
          tenant_id: context.tenantId,
          store_id: storeId,
          product_id: item.product_id,
          movement_type: "CUSTOMER_RETURN",
          quantity: item.quantity,
          reference: returnNumber,
          notes: `Réintégration stock sur retour client ${returnNumber} (${returnReason})`,
        });
      }
    }

    // 5. Créer la Facture d'Avoir (Credit Note)
    let createdCreditNote = null;
    if (totalRefundAmount > 0 && creditNoteNumber) {
      const { data: cn } = await admin
        .from("credit_notes")
        .insert({
          tenant_id: context.tenantId,
          credit_note_number: creditNoteNumber,
          order_id: orderId,
          return_id: createdReturn.id,
          customer_id: order.customer_id,
          customer_name: order.customer_name || "Client comptoir",
          amount: totalRefundAmount,
          currency: "XOF",
          reason: returnReason,
          created_by_user_id: context.user.id,
        })
        .select()
        .single();

      createdCreditNote = cn;
    }

    return NextResponse.json(
      {
        returnRecord: createdReturn,
        creditNote: createdCreditNote,
      },
      { status: 201 }
    );
  } catch (cause) {
    console.error("[returns.POST] error", cause);
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
