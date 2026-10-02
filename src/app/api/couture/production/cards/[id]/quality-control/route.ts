import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import type { CoutureProductionStepType } from "@/lib/couture-production";

const validRejectionSteps: CoutureProductionStepType[] = ["COUPE", "COUTURE", "BRODERIE", "FINITION_REPASSAGE"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id: cardId } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "production.quality_control");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const result = body.result === "PASSED" ? "PASSED" : "REJECTED";
    const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim().slice(0, 1000) : null;
    const targetStep: CoutureProductionStepType | null =
      result === "REJECTED" && validRejectionSteps.includes(body.rejectionTargetStep)
        ? body.rejectionTargetStep
        : result === "REJECTED"
        ? "COUTURE"
        : null;

    if (result === "REJECTED" && !rejectionReason) {
      return NextResponse.json({ error: "Le motif de non-conformité est obligatoire en cas de rejet." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Vérifier la fiche de fabrication
    const { data: card, error: cardErr } = await admin
      .from("couture_production_cards")
      .select("id, card_number, status, current_step")
      .eq("id", cardId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (cardErr || !card) {
      return NextResponse.json({ error: "Fiche de fabrication introuvable." }, { status: 404 });
    }

    // 2. Insérer le contrôle qualité
    const { data: qc, error: qcErr } = await admin
      .from("couture_quality_controls")
      .insert({
        tenant_id: context.tenantId,
        card_id: cardId,
        inspector_user_id: context.user.id,
        result,
        rejection_reason: rejectionReason,
        rejection_target_step: targetStep,
      })
      .select()
      .single();

    if (qcErr || !qc) {
      return NextResponse.json({ error: "Impossible d'enregistrer le contrôle qualité." }, { status: 500 });
    }

    // 3. Traiter le résultat sur les étapes et la fiche
    if (result === "PASSED") {
      // Marquer CONTROLE_QUALITE terminé
      await admin
        .from("couture_production_steps")
        .update({
          status: "COMPLETED",
          completed_at: new Date().toISOString(),
          notes: "Conforme aux standards de qualité Distinction.",
        })
        .eq("card_id", cardId)
        .eq("tenant_id", context.tenantId)
        .eq("step_type", "CONTROLE_QUALITE");

      // Activer l'étape suivante EMBALLAGE
      await admin
        .from("couture_production_steps")
        .update({ status: "IN_PROGRESS" })
        .eq("card_id", cardId)
        .eq("tenant_id", context.tenantId)
        .eq("step_type", "EMBALLAGE");

      // Mettre à jour la fiche
      await admin
        .from("couture_production_cards")
        .update({
          current_step: "EMBALLAGE",
          status: "PACKED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", cardId)
        .eq("tenant_id", context.tenantId);
    } else {
      // Rejet : renvoyer à l'étape cible
      await admin
        .from("couture_production_steps")
        .update({
          status: "REJECTED",
          notes: `Rejeté au contrôle qualité : ${rejectionReason}`,
        })
        .eq("card_id", cardId)
        .eq("tenant_id", context.tenantId)
        .eq("step_type", "CONTROLE_QUALITE");

      // Remettre l'étape cible en statut IN_PROGRESS
      if (targetStep) {
        await admin
          .from("couture_production_steps")
          .update({
            status: "IN_PROGRESS",
            notes: `Retour retouche qualité : ${rejectionReason}`,
          })
          .eq("card_id", cardId)
          .eq("tenant_id", context.tenantId)
          .eq("step_type", targetStep);
      }

      // Mettre à jour la fiche
      await admin
        .from("couture_production_cards")
        .update({
          current_step: targetStep || "COUTURE",
          status: "IN_PRODUCTION",
          updated_at: new Date().toISOString(),
        })
        .eq("id", cardId)
        .eq("tenant_id", context.tenantId);
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.production.quality_control",
      entityType: "couture_quality_controls",
      entityId: qc.id,
      metadata: {
        cardId,
        result,
        rejectionReason,
        targetStep,
      },
    });

    return NextResponse.json({
      success: true,
      qualityControl: qc,
      passed: result === "PASSED",
      message:
        result === "PASSED"
          ? "Contrôle qualité validé avec succès. Pièce transmise à l'emballage."
          : `Contrôle qualité refusé. Pièce renvoyée à l'étape ${targetStep} pour correction.`,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
