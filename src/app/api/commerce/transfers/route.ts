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

    const { data: transfers, error: trfErr } = await admin
      .from("commerce_transfers")
      .select(`
        id, transfer_number, source_store_id, destination_store_id, status,
        notes, created_at, shipped_at, received_at,
        commerce_transfer_items (
          id, product_id, product_name, quantity_requested, quantity_shipped, quantity_received, notes
        )
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (trfErr) {
      console.error("[commerce/transfers.GET] error", trfErr);
      return NextResponse.json({ error: "Impossible de récupérer les transferts." }, { status: 500 });
    }

    // Récupérer les magasins pour l'affichage
    const { data: stores } = await admin
      .from("commerce_stores")
      .select("id, name, store_type")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE");

    return NextResponse.json({ transfers: transfers || [], stores: stores || [] });
  } catch (err) {
    console.error("[commerce/transfers.GET] unexpected error", err);
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
    const { sourceStoreId, destinationStoreId, notes, items } = body;

    if (!sourceStoreId || !destinationStoreId) {
      return NextResponse.json({ error: "Magasin source et magasin de destination obligatoires." }, { status: 400 });
    }

    if (sourceStoreId === destinationStoreId) {
      return NextResponse.json({ error: "Le magasin source et la destination doivent être distincts." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Le transfert doit comporter au moins un article." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Génération du numéro séquentiel TRF
    let transferNumber: string;
    try {
      const { data: numData, error: numErr } = await admin.rpc("next_document_number", {
        p_tenant_id: context.tenantId,
        p_doc_type: "STOCK_TRANSFER",
      });
      if (numErr || !numData) {
        transferNumber = `TRF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      } else {
        transferNumber = numData;
      }
    } catch {
      transferNumber = `TRF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }

    const { data: createdTransfer, error: trfErr } = await admin
      .from("commerce_transfers")
      .insert({
        tenant_id: context.tenantId,
        transfer_number: transferNumber,
        source_store_id: sourceStoreId,
        destination_store_id: destinationStoreId,
        status: "REQUESTED",
        requested_by_user_id: context.user.id,
        notes: notes ? String(notes).trim() : null,
      })
      .select()
      .single();

    if (trfErr || !createdTransfer) {
      console.error("[commerce/transfers.POST] insert failed", trfErr);
      return NextResponse.json({ error: "Impossible de créer la demande de transfert." }, { status: 500 });
    }

    const itemsToInsert = items.map((item: Record<string, unknown>) => ({
      tenant_id: context.tenantId,
      transfer_id: createdTransfer.id,
      product_id: item.productId,
      product_name: String(item.productName || "Article").trim(),
      quantity_requested: Math.max(1, Number(item.quantityRequested) || 1),
      quantity_shipped: 0,
      quantity_received: 0,
      notes: item.notes ? String(item.notes).trim() : null,
    }));

    await admin.from("commerce_transfer_items").insert(itemsToInsert);

    return NextResponse.json({
      success: true,
      transfer: createdTransfer,
      message: `Demande de transfert ${transferNumber} créée avec succès.`,
    });
  } catch (err) {
    console.error("[commerce/transfers.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await request.json();
    const { transferId, action, itemsReceived } = body;

    if (!transferId || !action) {
      return NextResponse.json({ error: "Identifiant du transfert et action obligatoires." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Récupérer le transfert et ses lignes
    const { data: transfer, error: trfErr } = await admin
      .from("commerce_transfers")
      .select(`
        id, transfer_number, source_store_id, destination_store_id, status,
        commerce_transfer_items ( id, product_id, product_name, quantity_requested, quantity_shipped, quantity_received )
      `)
      .eq("id", transferId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (trfErr || !transfer) {
      return NextResponse.json({ error: "Transfert introuvable." }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "SHIP") {
      if (transfer.status !== "REQUESTED" && transfer.status !== "APPROVED") {
        return NextResponse.json({ error: "Ce transfert ne peut plus être expédié." }, { status: 400 });
      }

      // Décrémenter le stock dans le magasin source pour chaque article
      for (const item of transfer.commerce_transfer_items || []) {
        const qtyToShip = Number(item.quantity_requested) || 0;
        if (qtyToShip <= 0) continue;

        const { data: invRow } = await admin
          .from("store_inventory")
          .select("id, current_stock")
          .eq("store_id", transfer.source_store_id)
          .eq("product_id", item.product_id)
          .maybeSingle();

        const currentQty = Number(invRow?.current_stock) || 0;
        const newQty = Math.max(0, currentQty - qtyToShip);

        if (invRow) {
          await admin
            .from("store_inventory")
            .update({ current_stock: newQty, updated_at: now })
            .eq("id", invRow.id);
        }

        // Mettre à jour l'item
        await admin
          .from("commerce_transfer_items")
          .update({ quantity_shipped: qtyToShip })
          .eq("id", item.id);

        // Mouvement de stock sortant
        await admin.from("stock_movements").insert({
          tenant_id: context.tenantId,
          store_id: transfer.source_store_id,
          product_id: item.product_id,
          movement_type: "OUT_TRANSFER",
          quantity: -qtyToShip,
          reference: transfer.transfer_number,
          notes: `Expédition transfert ${transfer.transfer_number} vers dépôt cible`,
        });
      }

      await admin
        .from("commerce_transfers")
        .update({
          status: "IN_TRANSIT",
          shipped_by_user_id: context.user.id,
          shipped_at: now,
          updated_at: now,
        })
        .eq("id", transfer.id);

      return NextResponse.json({
        success: true,
        message: `Transfert ${transfer.transfer_number} expédié. Marchandise en transit.`,
      });
    }

    if (action === "RECEIVE") {
      if (transfer.status !== "IN_TRANSIT") {
        return NextResponse.json({ error: "Seul un transfert en transit peut être réceptionné." }, { status: 400 });
      }

      // Incrémenter le stock dans le magasin de destination
      const receivedItemsMap = new Map<string, number>();
      if (Array.isArray(itemsReceived)) {
        for (const it of itemsReceived) {
          receivedItemsMap.set(it.productId, Number(it.quantityReceived) || 0);
        }
      }

      for (const item of transfer.commerce_transfer_items || []) {
        const qtyReceived = receivedItemsMap.has(item.product_id)
          ? receivedItemsMap.get(item.product_id)!
          : Number(item.quantity_shipped) || Number(item.quantity_requested) || 0;

        const { data: invRow } = await admin
          .from("store_inventory")
          .select("id, current_stock")
          .eq("store_id", transfer.destination_store_id)
          .eq("product_id", item.product_id)
          .maybeSingle();

        const currentQty = Number(invRow?.current_stock) || 0;
        const newQty = currentQty + qtyReceived;

        if (invRow) {
          await admin
            .from("store_inventory")
            .update({ current_stock: newQty, updated_at: now })
            .eq("id", invRow.id);
        } else {
          await admin.from("store_inventory").insert({
            tenant_id: context.tenantId,
            store_id: transfer.destination_store_id,
            product_id: item.product_id,
            current_stock: newQty,
            updated_at: now,
          });
        }

        await admin
          .from("commerce_transfer_items")
          .update({ quantity_received: qtyReceived })
          .eq("id", item.id);

        // Mouvement de stock entrant
        await admin.from("stock_movements").insert({
          tenant_id: context.tenantId,
          store_id: transfer.destination_store_id,
          product_id: item.product_id,
          movement_type: "IN_TRANSFER",
          quantity: qtyReceived,
          reference: transfer.transfer_number,
          notes: `Réception transfert ${transfer.transfer_number} au dépôt cible`,
        });
      }

      await admin
        .from("commerce_transfers")
        .update({
          status: "RECEIVED",
          received_by_user_id: context.user.id,
          received_at: now,
          updated_at: now,
        })
        .eq("id", transfer.id);

      return NextResponse.json({
        success: true,
        message: `Transfert ${transfer.transfer_number} réceptionné. Stock crédité dans le magasin cible.`,
      });
    }

    return NextResponse.json({ error: "Action non reconnue." }, { status: 400 });
  } catch (err) {
    console.error("[commerce/transfers.PATCH] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
