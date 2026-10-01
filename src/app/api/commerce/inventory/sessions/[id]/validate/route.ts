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

    // 1. Contrôle strict de Séparation des Tâches (Règle PRD Section 4 & 6.9)
    // Seul le Promoteur / Administrateur ou le Gérant avec droit de validation peut valider les ajustements financiers
    const allowedRoles = ["ADMINISTRATEUR", "GERANT", "SUPERVISEUR"];
    const canValidate = allowedRoles.includes(context.role || "") || context.permissions.has("inventory.validate");

    if (!canValidate) {
      return NextResponse.json({
        error: "Accès refusé. La validation des ajustements d'inventaire exige l'autorisation du Promoteur ou du Gérant (Séparation des tâches).",
      }, { status: 403 });
    }

    const { id: sessionId } = await params;
    const admin = createSupabaseAdminClient();

    // 2. Récupérer la session et ses lignes
    const { data: session, error: sessErr } = await admin
      .from("commerce_inventory_sessions")
      .select(`
        id, session_number, store_id, status, total_variance_value_xof,
        commerce_inventory_items (
          id, product_id, product_name, unit_cost_xof, theoretical_quantity, final_quantity, variance_quantity, justification
        )
      `)
      .eq("id", sessionId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Session d'inventaire introuvable." }, { status: 404 });
    }

    if (session.status === "VALIDATED") {
      return NextResponse.json({ error: "Cette session d'inventaire a déjà été validée." }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 3. Appliquer les ajustements de stock physiques et enregistrer les mouvements d'écart
    for (const item of session.commerce_inventory_items || []) {
      const finalQty = item.final_quantity !== null && item.final_quantity !== undefined
        ? Number(item.final_quantity)
        : Number(item.theoretical_quantity);

      const varianceQty = Number(item.variance_quantity) || 0;

      // Mettre à jour store_inventory
      const { data: invRow } = await admin
        .from("store_inventory")
        .select("id")
        .eq("store_id", session.store_id)
        .eq("product_id", item.product_id)
        .maybeSingle();

      if (invRow) {
        await admin
          .from("store_inventory")
          .update({ current_stock: finalQty, updated_at: now })
          .eq("id", invRow.id);
      } else {
        await admin.from("store_inventory").insert({
          tenant_id: context.tenantId,
          store_id: session.store_id,
          product_id: item.product_id,
          current_stock: finalQty,
          updated_at: now,
        });
      }

      // Si écart, tracer le mouvement de régularisation
      if (varianceQty !== 0) {
        await admin.from("stock_movements").insert({
          tenant_id: context.tenantId,
          store_id: session.store_id,
          product_id: item.product_id,
          movement_type: "ADJUSTMENT",
          quantity: varianceQty,
          reference: session.session_number,
          notes: `Régularisation inventaire ${session.session_number} : écart de ${varianceQty} unités (${item.justification || "Ajustement physique"}).`,
        });
      }

      // Marquer la ligne comme ADJUSTED
      await admin
        .from("commerce_inventory_items")
        .update({ status: "ADJUSTED", updated_at: now })
        .eq("id", item.id);
    }

    // 4. Clôturer et valider la session
    const { data: updatedSession, error: updateErr } = await admin
      .from("commerce_inventory_sessions")
      .update({
        status: "VALIDATED",
        validated_by_user_id: context.user.id,
        validated_at: now,
        updated_at: now,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateErr) {
      console.error("[inventory/sessions.validate] update failed", updateErr);
      return NextResponse.json({ error: "Échec de validation de la session." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
      message: `Inventaire ${session.session_number} validé avec succès. Les stocks physiques ont été régularisés.`,
    });
  } catch (err) {
    console.error("[inventory/sessions.validate] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
