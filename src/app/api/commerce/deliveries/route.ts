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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ALL";

    const admin = createSupabaseAdminClient();

    // 1. Charger les bons de livraison
    let dnQuery = admin
      .from("delivery_notes")
      .select(`
        id,
        delivery_number,
        order_id,
        store_id,
        customer_name,
        status,
        pickup_code,
        recipient_name,
        delivered_at,
        created_at,
        delivery_note_items(id, product_name, quantity_ordered, quantity_delivered, unit)
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status !== "ALL") {
      dnQuery = dnQuery.eq("status", status);
    }

    const { data: deliveryNotes, error: dnErr } = await dnQuery;
    if (dnErr) {
      return NextResponse.json({ error: "Impossible de charger les bons de livraison." }, { status: 500 });
    }

    // 2. Charger les commandes payées en attente de préparation/livraison
    const { data: pendingOrders, error: poErr } = await admin
      .from("orders")
      .select(`
        id,
        invoice_number,
        customer_name,
        total_amount,
        amount_paid,
        payment_status,
        status,
        created_at,
        order_items(id, product_id, product_name, quantity, unit_price)
      `)
      .eq("tenant_id", context.tenantId)
      .in("payment_status", ["PAID"])
      .neq("status", "DELIVERED")
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(50);

    if (poErr) {
      console.error("[deliveries.GET] orders fetch error", poErr);
    }

    return NextResponse.json({
      deliveryNotes: deliveryNotes ?? [],
      pendingOrders: pendingOrders ?? [],
    });
  } catch (cause) {
    console.error("[deliveries.GET] error", cause);
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
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;

    if (!orderId) {
      return NextResponse.json({ error: "Identifiant de commande requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Vérifier que la commande existe, appartient au tenant et est payée
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, tenant_id, customer_name, customer_id, payment_status, status, order_items(product_id, product_name, quantity)")
      .eq("id", orderId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (oErr || !order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    if (order.payment_status !== "PAID" && order.status !== "PAID") {
      return NextResponse.json(
        { error: "Règle stricte du PRD : seules les commandes entièrement payées peuvent faire l'objet d'un bon de livraison." },
        { status: 400 }
      );
    }

    // 2. Générer le numéro séquentiel sans trou BL-YYYY-XXXXXX
    const { data: deliveryNumber, error: seqErr } = await admin.rpc("next_document_number", {
      p_tenant_id: context.tenantId,
      p_doc_type: "DELIVERY_NOTE",
    });

    if (seqErr || !deliveryNumber) {
      console.error("[deliveries.POST] seq generation failed", seqErr);
      return NextResponse.json({ error: "Erreur lors de la numérotation séquentielle du bon de livraison." }, { status: 500 });
    }

    // 3. Créer le Bon de Livraison
    const { data: deliveryNote, error: dnErr } = await admin
      .from("delivery_notes")
      .insert({
        tenant_id: context.tenantId,
        order_id: orderId,
        delivery_number: deliveryNumber,
        store_id: storeId,
        customer_id: order.customer_id,
        customer_name: order.customer_name || "Client comptoir",
        status: "PREPARED",
        notes,
      })
      .select()
      .single();

    if (dnErr || !deliveryNote) {
      console.error("[deliveries.POST] insert failed", dnErr);
      return NextResponse.json({ error: "Impossible de créer le bon de livraison." }, { status: 500 });
    }

    // 4. Copier les lignes de commande dans delivery_note_items
    const items = (order.order_items || []).map((item) => ({
      tenant_id: context.tenantId,
      delivery_note_id: deliveryNote.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity_ordered: Number(item.quantity) || 1,
      quantity_delivered: 0,
    }));

    if (items.length > 0) {
      await admin.from("delivery_note_items").insert(items);
    }

    return NextResponse.json({ deliveryNote }, { status: 201 });
  } catch (cause) {
    console.error("[deliveries.POST] error", cause);
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
