import { NextResponse } from "next/server";
import { getCoutureContext } from "@/lib/couture-auth";
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

    const { id } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const stage = String(body.stage || "").toUpperCase(); // BUYER_OPINION | ACCOUNTANT_APPROVE | DIRECTION_APPROVE | REJECT
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;

    const admin = createSupabaseAdminClient();

    // 1. Charger la demande
    const { data: purchaseReq, error: fetchErr } = await admin
      .from("couture_supply_purchase_requests")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .single();

    if (fetchErr || !purchaseReq) {
      return NextResponse.json({ error: "Demande d'achat introuvable." }, { status: 404 });
    }

    if (purchaseReq.status === "APPROVED" || purchaseReq.status === "REJECTED") {
      return NextResponse.json({ error: `Cette demande est déjà traitée (${purchaseReq.status}).` }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // 2. Traitement selon l'étape et les permissions requises
    if (stage === "BUYER_OPINION") {
      const isFavorable = body.opinion !== "UNFAVORABLE";
      updates.buyer_opinion = isFavorable ? "FAVORABLE" : "UNFAVORABLE";
      updates.buyer_notes = notes;
      updates.buyer_user_id = context.user.id;
    } else if (stage === "ACCOUNTANT_APPROVE") {
      if (!context.permissions.has("purchases.approve_small")) {
        return NextResponse.json({ error: "Permission de validation comptable requise (purchases.approve_small)." }, { status: 403 });
      }
      updates.accountant_approval = "APPROVED";
      updates.accountant_notes = notes;
      updates.accountant_user_id = context.user.id;

      if (purchaseReq.approval_route === "SINGLE_ACCOUNTANT") {
        updates.status = "APPROVED";
      } else {
        // En circuit 3 étapes, direction_approval devient PENDING
        updates.direction_approval = "PENDING";
      }
    } else if (stage === "DIRECTION_APPROVE") {
      if (!context.permissions.has("purchases.approve_large")) {
        return NextResponse.json({ error: "Permission d'approbation Direction requise (purchases.approve_large)." }, { status: 403 });
      }
      if (purchaseReq.approval_route === "THREE_STEP" && purchaseReq.accountant_approval !== "APPROVED") {
        return NextResponse.json({ error: "La validation préalable du comptable est obligatoire." }, { status: 400 });
      }
      updates.direction_approval = "APPROVED";
      updates.direction_notes = notes;
      updates.direction_user_id = context.user.id;
      updates.status = "APPROVED";
    } else if (stage === "REJECT") {
      updates.status = "REJECTED";
      if (notes) updates.accountant_notes = notes;
    } else {
      return NextResponse.json({ error: "Étape de validation invalide." }, { status: 400 });
    }

    const { data: updatedReq, error: updateErr } = await admin
      .from("couture_supply_purchase_requests")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (updateErr || !updatedReq) {
      return NextResponse.json({ error: "Erreur lors de la mise à jour de la demande." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: `couture.purchase.${stage.toLowerCase()}`,
      entityType: "couture_supply_purchase_requests",
      entityId: id,
      metadata: {
        stage,
        newStatus: updatedReq.status,
        requestNumber: updatedReq.request_number,
      },
    });

    return NextResponse.json({
      success: true,
      request: updatedReq,
      message: `Demande d'achat mise à jour (${stage}). Statut : ${updatedReq.status}`,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
