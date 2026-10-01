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

    // 1. Récupérer les demandes d'achat
    const { data: requests, error: reqErr } = await admin
      .from("purchase_requests")
      .select(`
        id, request_number, status, priority, total_estimated_amount_xof, notes, created_at,
        requested_by_user_id, approved_by_user_id, approved_at, store_id, supplier_id,
        purchase_request_items (
          id, product_id, product_name, quantity_requested, estimated_unit_price_xof, notes
        )
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (reqErr) {
      console.error("[procurement/requests.GET] error fetching requests", reqErr);
      return NextResponse.json({ error: "Impossible de récupérer les demandes d'achat." }, { status: 500 });
    }

    // 2. Récupérer les suggestions de réapprovisionnement (articles dont le stock <= seuil d'alerte / point de commande)
    // On consulte commerce_products et store_inventory
    const { data: products } = await admin
      .from("commerce_products")
      .select("id, name, internal_code, min_stock, reorder_point, weighted_avg_cost_xof, purchase_price_xof, primary_supplier_id")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE");

    const { data: inventories } = await admin
      .from("store_inventory")
      .select("product_id, current_stock, store_id")
      .eq("tenant_id", context.tenantId);

    const inventoryMap = new Map<string, number>();
    for (const inv of inventories || []) {
      const current = inventoryMap.get(inv.product_id) || 0;
      inventoryMap.set(inv.product_id, current + (Number(inv.current_stock) || 0));
    }

    const suggestions = (products || [])
      .map((p) => {
        const currentStock = inventoryMap.get(p.id) || 0;
        const reorderPoint = Number(p.reorder_point) || Number(p.min_stock) || 0;
        const isLow = currentStock <= reorderPoint;
        const suggestedQty = Math.max(1, (reorderPoint * 2) - currentStock);
        return {
          productId: p.id,
          name: p.name,
          internalCode: p.internal_code,
          currentStock,
          reorderPoint,
          isLow,
          suggestedQty,
          estimatedCostXof: Number(p.weighted_avg_cost_xof || p.purchase_price_xof || 0),
          supplierId: p.primary_supplier_id,
        };
      })
      .filter((s) => s.isLow);

    // 3. Récupérer les fournisseurs et magasins pour les formulaires
    const { data: suppliers } = await admin
      .from("commerce_suppliers")
      .select("id, name, phone, email, payment_terms_days, lead_time_days")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true });

    const { data: stores } = await admin
      .from("commerce_stores")
      .select("id, name, store_type")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true });

    return NextResponse.json({
      requests: requests || [],
      suggestions: suggestions || [],
      suppliers: suppliers || [],
      stores: stores || [],
    });
  } catch (err) {
    console.error("[procurement/requests.GET] unexpected error", err);
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
    const { storeId, supplierId, priority = "NORMAL", notes, items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Une demande d'achat doit comporter au moins un article." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Génération du numéro de séquence DA
    let requestNumber: string;
    try {
      const { data: numData, error: numErr } = await admin.rpc("next_document_number", {
        p_tenant_id: context.tenantId,
        p_doc_type: "PURCHASE_REQUEST",
      });
      if (numErr || !numData) {
        requestNumber = `DA-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      } else {
        requestNumber = numData;
      }
    } catch {
      requestNumber = `DA-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }

    let totalEstimated = 0;
    const itemsToInsert = items.map((item: any) => {
      const qty = Math.max(1, Number(item.quantityRequested) || 1);
      const unitPrice = Math.max(0, Math.round(Number(item.estimatedUnitPriceXof) || 0));
      totalEstimated += qty * unitPrice;
      return {
        tenant_id: context.tenantId,
        product_id: item.productId,
        product_name: String(item.productName || "Article").trim(),
        quantity_requested: qty,
        estimated_unit_price_xof: unitPrice,
        notes: item.notes ? String(item.notes).trim() : null,
      };
    });

    const { data: createdRequest, error: reqErr } = await admin
      .from("purchase_requests")
      .insert({
        tenant_id: context.tenantId,
        request_number: requestNumber,
        requested_by_user_id: context.user.id,
        store_id: storeId || null,
        supplier_id: supplierId || null,
        status: "PENDING",
        priority: priority === "URGENT" || priority === "LOW" ? priority : "NORMAL",
        total_estimated_amount_xof: totalEstimated,
        notes: notes ? String(notes).trim() : null,
      })
      .select()
      .single();

    if (reqErr || !createdRequest) {
      console.error("[procurement/requests.POST] insert failed", reqErr);
      return NextResponse.json({ error: "Impossible de créer la demande d'achat." }, { status: 500 });
    }

    const finalItems = itemsToInsert.map((it: any) => ({
      ...it,
      request_id: createdRequest.id,
    }));

    const { error: itemsErr } = await admin.from("purchase_request_items").insert(finalItems);
    if (itemsErr) {
      console.error("[procurement/requests.POST] items insert failed", itemsErr);
    }

    return NextResponse.json({
      success: true,
      request: createdRequest,
      message: `Demande d'achat ${requestNumber} créée avec succès.`,
    });
  } catch (err) {
    console.error("[procurement/requests.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
