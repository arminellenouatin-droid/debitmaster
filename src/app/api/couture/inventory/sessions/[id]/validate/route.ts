import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id: sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "inventory.validate");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Récupérer la session
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
      return NextResponse.json({ error: "Cette session d'inventaire a déjà été validée." }, { status: 400 });
    }

    // 2. Récupérer les comptages
    const { data: counts, error: countsErr } = await admin
      .from("couture_inventory_counts")
      .select("*")
      .eq("session_id", sessionId)
      .eq("tenant_id", context.tenantId);

    if (countsErr || !counts || counts.length === 0) {
      return NextResponse.json({ error: "Aucun comptage trouvé pour cette session. Enregistrez les comptages avant validation." }, { status: 400 });
    }

    let totalVarianceQuantity = 0;
    let totalVarianceValueXof = 0;

    // 3. Ajuster les stocks réels selon le type d'inventaire
    for (const count of counts) {
      totalVarianceQuantity += Number(count.variance_quantity) || 0;
      totalVarianceValueXof += Number(count.variance_value_xof) || 0;

      const physicalQty = Math.max(0, Math.round(Number(count.counted_quantity) || 0));

      if (session.inventory_type === "BOUTIQUE_FINISHED_GOODS") {
        // Ajuster couture_boutique_stocks
        // reference_id correspond à un id de couture_boutique_stocks ou model_id
        const { data: stockRow } = await admin
          .from("couture_boutique_stocks")
          .select("id")
          .eq("id", count.reference_id)
          .eq("tenant_id", context.tenantId)
          .maybeSingle();

        if (stockRow) {
          await admin
            .from("couture_boutique_stocks")
            .update({
              quantity: physicalQty,
              updated_at: new Date().toISOString(),
            })
            .eq("id", stockRow.id);
        } else {
          // Si reference_id est un model_id ou accessory_id, tenter la mise à jour sur le site
          await admin
            .from("couture_boutique_stocks")
            .update({
              quantity: physicalQty,
              updated_at: new Date().toISOString(),
            })
            .eq("site_id", session.site_id)
            .or(`model_id.eq.${count.reference_id},accessory_id.eq.${count.reference_id}`);
        }
      } else if (session.inventory_type === "ATELIER_SUPPLIES") {
        // Ajuster couture_supplies
        await admin
          .from("couture_supplies")
          .update({
            stock_quantity: physicalQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", count.reference_id)
          .eq("tenant_id", context.tenantId);
      }
    }

    // 4. Clôturer la session
    const validatedAt = new Date().toISOString();
    const { data: updatedSession, error: updateErr } = await admin
      .from("couture_inventory_sessions")
      .update({
        status: "VALIDATED",
        validated_by: context.user.id,
        validated_at: validatedAt,
        updated_at: validatedAt,
      })
      .eq("id", sessionId)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: "Erreur lors de la validation finale de la session." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.inventory.validate",
      entityType: "couture_inventory_sessions",
      entityId: sessionId,
      metadata: {
        inventoryNumber: session.inventory_number,
        totalItems: counts.length,
        totalVarianceQuantity,
        totalVarianceValueXof,
      },
    });

    return NextResponse.json({
      success: true,
      session: updatedSession,
      summary: {
        totalLines: counts.length,
        totalVarianceQuantity,
        totalVarianceValueXof,
      },
      message: "Inventaire physique validé avec succès. Les stocks réels ont été mis à jour.",
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
