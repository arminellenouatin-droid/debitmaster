import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { calculateInventoryVariance } from "@/lib/couture-stocks";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id: sessionId } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "inventory.count");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const countsInput = Array.isArray(body.counts) ? body.counts : [];
    if (countsInput.length === 0) {
      return NextResponse.json({ error: "Au moins une ligne de comptage requise." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Vérifier la session
    const { data: session, error: sessErr } = await admin
      .from("couture_inventory_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Session d'inventaire introuvable." }, { status: 404 });
    }

    if (session.status === "VALIDATED") {
      return NextResponse.json({ error: "Cette session d'inventaire est déjà validée et clôturée." }, { status: 400 });
    }

    // 2. Traiter chaque comptage et calculer les écarts
    const countsToInsert = [];
    for (const item of countsInput) {
      const itemType = ["CLOTHING", "ACCESSORY", "SUPPLY"].includes(item.itemType) ? item.itemType : "CLOTHING";
      const referenceId = typeof item.referenceId === "string" ? item.referenceId.trim() : "";
      const itemLabel = typeof item.itemLabel === "string" ? item.itemLabel.trim().slice(0, 240) : "Article";
      const theoreticalQty = Math.max(0, Number(item.theoreticalQuantity) || 0);
      const countedQty = Math.max(0, Number(item.countedQuantity) || 0);
      const unitCost = Math.max(0, Math.floor(Number(item.unitCostXof) || 0));

      const varianceRes = calculateInventoryVariance(theoreticalQty, countedQty, unitCost);

      countsToInsert.push({
        tenant_id: context.tenantId,
        session_id: sessionId,
        item_type: itemType,
        reference_id: referenceId,
        item_label: itemLabel,
        theoretical_quantity: theoreticalQty,
        counted_quantity: countedQty,
        variance_quantity: varianceRes.varianceQuantity,
        unit_cost_xof: unitCost,
        variance_value_xof: varianceRes.varianceValueXof,
      });
    }

    // Remplacer les comptages existants
    await admin.from("couture_inventory_counts").delete().eq("session_id", sessionId).eq("tenant_id", context.tenantId);

    const { data: insertedCounts, error: insertErr } = await admin
      .from("couture_inventory_counts")
      .insert(countsToInsert)
      .select();

    if (insertErr) {
      return NextResponse.json({ error: "Erreur lors de l'enregistrement des comptages." }, { status: 500 });
    }

    // Passer la session en COMPLETED (prête pour validation)
    await admin
      .from("couture_inventory_sessions")
      .update({
        status: "COMPLETED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("tenant_id", context.tenantId);

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.inventory.record_counts",
      entityType: "couture_inventory_sessions",
      entityId: sessionId,
      metadata: {
        inventoryNumber: session.inventory_number,
        countsRecorded: countsToInsert.length,
      },
    });

    return NextResponse.json({
      success: true,
      counts: insertedCounts,
      message: `${countsToInsert.length} comptages enregistrés avec calcul des écarts. Session prête pour validation.`,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
