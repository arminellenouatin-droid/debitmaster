import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const admin = createSupabaseAdminClient();

    const { data: session, error: sessErr } = await admin
      .from("commerce_inventory_sessions")
      .select(`
        id, session_number, store_id, inventory_type, category_id, status, is_blind_count,
        total_theoretical_value_xof, total_counted_value_xof, total_variance_value_xof,
        total_items_count, discrepancies_count, notes, started_at, validated_at, created_at,
        commerce_inventory_items (
          id, product_id, product_name, internal_code, unit_cost_xof,
          theoretical_quantity, counted_quantity, recounted_quantity, final_quantity,
          variance_quantity, variance_amount_xof, status, justification
        )
      `)
      .eq("id", sessionId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Session d'inventaire introuvable." }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (err) {
    console.error("[inventory/sessions.[id].GET] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}

export async function PATCH(
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

    const { id: sessionId } = await params;
    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Format des données de comptage invalide." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: session, error: sessErr } = await admin
      .from("commerce_inventory_sessions")
      .select("id, status, total_items_count")
      .eq("id", sessionId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Session d'inventaire introuvable." }, { status: 404 });
    }

    if (session.status === "VALIDATED") {
      return NextResponse.json({ error: "Cette session d'inventaire est déjà validée et verrouillée." }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Récupérer les lignes existantes
    const { data: existingItems } = await admin
      .from("commerce_inventory_items")
      .select("id, theoretical_quantity, unit_cost_xof")
      .eq("session_id", sessionId);

    const existingMap = new Map((existingItems || []).map((it) => [it.id, it]));

    let totalCountedValue = 0;
    let totalVarianceValue = 0;
    let discrepanciesCount = 0;

    for (const update of items) {
      const existing = existingMap.get(update.itemId);
      if (!existing) continue;

      const theoQty = Number(existing.theoretical_quantity) || 0;
      const unitCost = Number(existing.unit_cost_xof) || 0;

      const count1 = update.countedQuantity !== undefined && update.countedQuantity !== null
        ? Math.max(0, Number(update.countedQuantity))
        : null;
      const recount = update.recountedQuantity !== undefined && update.recountedQuantity !== null
        ? Math.max(0, Number(update.recountedQuantity))
        : null;

      const finalQty = recount !== null ? recount : count1 !== null ? count1 : theoQty;
      const varianceQty = finalQty - theoQty;
      const varianceAmt = Math.round(varianceQty * unitCost);

      totalCountedValue += finalQty * unitCost;
      totalVarianceValue += varianceAmt;

      let lineStatus = "MATCHED";
      if (varianceQty !== 0) {
        discrepanciesCount++;
        lineStatus = recount !== null ? "RECOUNTED" : "DISCREPANCY";
      }

      await admin
        .from("commerce_inventory_items")
        .update({
          counted_quantity: count1,
          recounted_quantity: recount,
          final_quantity: finalQty,
          variance_quantity: varianceQty,
          variance_amount_xof: varianceAmt,
          status: lineStatus,
          justification: update.justification ? String(update.justification).trim() : null,
          counter_user_id: context.user.id,
          updated_at: now,
        })
        .eq("id", update.itemId);
    }

    // Mettre à jour les totaux de la session
    await admin
      .from("commerce_inventory_sessions")
      .update({
        status: "COUNTED",
        total_counted_value_xof: totalCountedValue,
        total_variance_value_xof: totalVarianceValue,
        discrepancies_count: discrepanciesCount,
        updated_at: now,
      })
      .eq("id", sessionId);

    return NextResponse.json({
      success: true,
      message: `Comptage enregistré avec succès (${discrepanciesCount} écart(s) détecté(s)).`,
    });
  } catch (err) {
    console.error("[inventory/sessions.[id].PATCH] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
