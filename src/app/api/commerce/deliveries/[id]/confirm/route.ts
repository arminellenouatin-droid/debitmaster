import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { id: deliveryNoteId } = await params;
    const body = await request.json();
    const recipientName = typeof body.recipientName === "string" ? body.recipientName.trim() : "Client réceptionnaire";
    const pickupCode = typeof body.pickupCode === "string" ? body.pickupCode.trim() : null;

    const admin = createSupabaseAdminClient();

    // 1. Récupérer le Bon de Livraison
    const { data: dn, error: dnErr } = await admin
      .from("delivery_notes")
      .select("id, tenant_id, order_id, store_id, status, delivery_number, customer_name, delivery_note_items(id, product_id, quantity_ordered, product_name)")
      .eq("id", deliveryNoteId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (dnErr || !dn) {
      return NextResponse.json({ error: "Bon de livraison introuvable." }, { status: 404 });
    }

    if (dn.status === "DELIVERED") {
      return NextResponse.json({ error: "Ce bon de livraison a déjà été confirmé comme livré." }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 2. Mettre à jour le Bon de Livraison
    const { data: updatedDn, error: updateErr } = await admin
      .from("delivery_notes")
      .update({
        status: "DELIVERED",
        recipient_name: recipientName,
        pickup_code: pickupCode,
        delivered_by_user_id: context.user.id,
        delivered_at: now,
        updated_at: now,
      })
      .eq("id", deliveryNoteId)
      .select()
      .single();

    if (updateErr) {
      console.error("[deliveries.confirm] dn update failed", updateErr);
      return NextResponse.json({ error: "Impossible de valider la livraison." }, { status: 500 });
    }

    // 3. Mettre à jour les lignes de BL (quantité livrée = quantité commandée)
    for (const item of dn.delivery_note_items || []) {
      await admin
        .from("delivery_note_items")
        .update({ quantity_delivered: item.quantity_ordered })
        .eq("id", item.id);

      // Si un magasin est rattaché, décrémenter le stock physique dans store_inventory s'il existe
      if (dn.store_id && item.product_id) {
        const { data: currentStock } = await admin
          .from("store_inventory")
          .select("current_stock")
          .eq("store_id", dn.store_id)
          .eq("product_id", item.product_id)
          .maybeSingle();

        if (currentStock) {
          const newQty = Math.max(0, (Number(currentStock.current_stock) || 0) - Number(item.quantity_ordered));
          await admin
            .from("store_inventory")
            .update({ current_stock: newQty, updated_at: now })
            .eq("store_id", dn.store_id)
            .eq("product_id", item.product_id);
        }

        // Enregistrer le mouvement de stock officiel
        await admin.from("stock_movements").insert({
          tenant_id: context.tenantId,
          store_id: dn.store_id,
          product_id: item.product_id,
          movement_type: "SALE_DELIVERY",
          quantity: -Number(item.quantity_ordered),
          reference: dn.delivery_number,
          notes: `Sortie de stock officielle sur livraison ${dn.delivery_number} à ${recipientName}`,
        });
      }
    }

    // 4. Mettre à jour la commande associée en statut DELIVERED
    await admin
      .from("orders")
      .update({ status: "DELIVERED", updated_at: now })
      .eq("id", dn.order_id);

    // 5. Régulariser les réservations de stock (order_stock_allocations) si existantes
    await admin
      .from("order_stock_allocations")
      .update({ status: "SETTLED" })
      .eq("order_id", dn.order_id);

    return NextResponse.json({
      success: true,
      deliveryNote: updatedDn,
      printPayload: {
        deliveryNumber: updatedDn.delivery_number,
        customerName: dn.customer_name,
        recipientName,
        deliveredAt: now,
        items: dn.delivery_note_items,
      },
    });
  } catch (cause) {
    console.error("[deliveries.confirm] error", cause);
    return NextResponse.json({ error: "Erreur serveur lors de la validation." }, { status: 500 });
  }
}
