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

    const { data: sessions, error: sessErr } = await admin
      .from("commerce_inventory_sessions")
      .select(`
        id, session_number, store_id, inventory_type, category_id, status, is_blind_count,
        total_theoretical_value_xof, total_counted_value_xof, total_variance_value_xof,
        total_items_count, discrepancies_count, notes, started_at, validated_at, created_at
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (sessErr) {
      console.error("[inventory/sessions.GET] error", sessErr);
      return NextResponse.json({ error: "Impossible de récupérer les sessions d'inventaire." }, { status: 500 });
    }

    const { data: stores } = await admin
      .from("commerce_stores")
      .select("id, name, store_type")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true });

    const { data: categories } = await admin
      .from("commerce_categories")
      .select("id, name")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true });

    return NextResponse.json({
      sessions: sessions || [],
      stores: stores || [],
      categories: categories || [],
    });
  } catch (err) {
    console.error("[inventory/sessions.GET] unexpected error", err);
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
    const { storeId, inventoryType = "GENERAL", categoryId, isBlindCount = false, notes } = body;

    if (!storeId) {
      return NextResponse.json({ error: "Le magasin est obligatoire pour créer une session d'inventaire." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Génération du numéro séquentiel INV
    let sessionNumber: string;
    try {
      const { data: numData, error: numErr } = await admin.rpc("next_document_number", {
        p_tenant_id: context.tenantId,
        p_doc_type: "INVENTORY_SESSION",
      });
      if (numErr || !numData) {
        sessionNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      } else {
        sessionNumber = numData;
      }
    } catch {
      sessionNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }

    // 2. Récupérer les produits du catalogue à geler pour cet inventaire
    let prodQuery = admin
      .from("commerce_products")
      .select("id, name, internal_code, category_id, weighted_avg_cost_xof, purchase_price_xof")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE");

    if (inventoryType === "PARTIAL" && categoryId) {
      prodQuery = prodQuery.eq("category_id", categoryId);
    }

    const { data: products, error: prodErr } = await prodQuery;
    if (prodErr || !products || products.length === 0) {
      return NextResponse.json({ error: "Aucun produit trouvé pour ce périmètre d'inventaire." }, { status: 400 });
    }

    // 3. Récupérer le stock physique théorique au moment T
    const { data: inventories } = await admin
      .from("store_inventory")
      .select("product_id, current_stock")
      .eq("store_id", storeId);

    const stockMap = new Map<string, number>();
    for (const inv of inventories || []) {
      stockMap.set(inv.product_id, Number(inv.current_stock) || 0);
    }

    let totalTheoreticalValue = 0;
    const itemsToInsert = products.map((p) => {
      const theoQty = stockMap.get(p.id) || 0;
      const unitCost = Number(p.weighted_avg_cost_xof || p.purchase_price_xof || 0);
      totalTheoreticalValue += theoQty * unitCost;

      return {
        tenant_id: context.tenantId,
        product_id: p.id,
        product_name: p.name,
        internal_code: p.internal_code,
        unit_cost_xof: unitCost,
        theoretical_quantity: theoQty,
        counted_quantity: null,
        recounted_quantity: null,
        final_quantity: null,
        variance_quantity: 0,
        variance_amount_xof: 0,
        status: "PENDING",
      };
    });

    const now = new Date().toISOString();

    // 4. Créer la session d'inventaire
    const { data: createdSession, error: sessErr } = await admin
      .from("commerce_inventory_sessions")
      .insert({
        tenant_id: context.tenantId,
        session_number: sessionNumber,
        store_id: storeId,
        inventory_type: inventoryType,
        category_id: categoryId || null,
        status: "IN_PROGRESS",
        is_blind_count: Boolean(isBlindCount),
        total_theoretical_value_xof: totalTheoreticalValue,
        total_counted_value_xof: 0,
        total_variance_value_xof: 0,
        total_items_count: itemsToInsert.length,
        discrepancies_count: 0,
        notes: notes ? String(notes).trim() : null,
        started_by_user_id: context.user.id,
        started_at: now,
      })
      .select()
      .single();

    if (sessErr || !createdSession) {
      console.error("[inventory/sessions.POST] insert error", sessErr);
      return NextResponse.json({ error: "Impossible d'initialiser la session d'inventaire." }, { status: 500 });
    }

    const finalItems = itemsToInsert.map((it) => ({
      ...it,
      session_id: createdSession.id,
    }));

    await admin.from("commerce_inventory_items").insert(finalItems);

    return NextResponse.json({
      success: true,
      session: createdSession,
      message: `Session d'inventaire ${sessionNumber} ouverte avec ${itemsToInsert.length} article(s) gelé(s).`,
    });
  } catch (err) {
    console.error("[inventory/sessions.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
