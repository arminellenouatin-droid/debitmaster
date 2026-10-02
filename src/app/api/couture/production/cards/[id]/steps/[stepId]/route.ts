import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { resolveCardStatusFromStep, type CoutureProductionStepType } from "@/lib/couture-production";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id: cardId, stepId } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    // Autoriser soit le chef d'atelier (production.manage), soit l'ouvrier déclarant (piecework.declare)
    const canManage = context.permissions.has("production.manage");
    const canDeclare = context.permissions.has("piecework.declare");
    if (!canManage && !canDeclare) {
      return NextResponse.json({ error: "Permission requise pour modifier une étape de fabrication." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Charger l'étape actuelle
    const { data: step, error: stepErr } = await admin
      .from("couture_production_steps")
      .select("id, card_id, step_order, step_type, status, assigned_employee_id, assigned_worker_user_id")
      .eq("id", stepId)
      .eq("card_id", cardId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (stepErr || !step) {
      return NextResponse.json({ error: "Étape de production introuvable." }, { status: 404 });
    }

    // 2. Si c'est un ouvrier qui déclare, vérifier qu'il est bien assigné (ou gestionnaire)
    if (!canManage && step.assigned_worker_user_id && step.assigned_worker_user_id !== context.user.id) {
      return NextResponse.json({ error: "Vous ne pouvez déclarer que vos propres tâches assignées." }, { status: 403 });
    }

    const newStatus = body.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETED";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;

    // 3. Mettre à jour l'étape
    const { data: updatedStep, error: updateErr } = await admin
      .from("couture_production_steps")
      .update({
        status: newStatus,
        completed_at: newStatus === "COMPLETED" ? new Date().toISOString() : null,
        notes: notes || undefined,
      })
      .eq("id", step.id)
      .select()
      .single();

    if (updateErr || !updatedStep) {
      return NextResponse.json({ error: "Erreur lors de la mise à jour de l'étape." }, { status: 500 });
    }

    // 4. Si terminée, trouver et préparer l'étape suivante
    if (newStatus === "COMPLETED") {
      const { data: nextStep } = await admin
        .from("couture_production_steps")
        .select("id, step_order, step_type")
        .eq("card_id", cardId)
        .eq("tenant_id", context.tenantId)
        .eq("step_order", step.step_order + 1)
        .maybeSingle();

      const nextStepType = (nextStep?.step_type as CoutureProductionStepType) || step.step_type;
      const newCardStatus = resolveCardStatusFromStep(nextStepType, "PENDING");

      await admin
        .from("couture_production_cards")
        .update({
          current_step: nextStepType,
          status: newCardStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cardId)
        .eq("tenant_id", context.tenantId);
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.production.step_status",
      entityType: "couture_production_steps",
      entityId: step.id,
      metadata: {
        cardId,
        stepType: step.step_type,
        newStatus,
      },
    });

    return NextResponse.json({
      success: true,
      step: updatedStep,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
