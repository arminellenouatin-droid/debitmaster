import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { isCraftCompatibleWithStep, type CoutureProductionStepType } from "@/lib/couture-production";

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

    assertCouturePermission(context, "production.assign");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    const stepId = typeof body.stepId === "string" ? body.stepId.trim() : "";

    if (!employeeId || !stepId) {
      return NextResponse.json({ error: "Ouvrier (employeeId) et étape (stepId) requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Charger l'ouvrier et ses métiers
    const { data: employee, error: empErr } = await admin
      .from("couture_employees")
      .select("id, user_id, full_name, crafts, is_active")
      .eq("id", employeeId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (empErr || !employee || !employee.is_active) {
      return NextResponse.json({ error: "Ouvrier introuvable ou inactif." }, { status: 404 });
    }

    // 2. Charger l'étape de production
    const { data: step, error: stepErr } = await admin
      .from("couture_production_steps")
      .select("id, card_id, step_order, step_type, status")
      .eq("id", stepId)
      .eq("card_id", cardId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (stepErr || !step) {
      return NextResponse.json({ error: "Étape de production introuvable sur cette fiche." }, { status: 404 });
    }

    // 3. Vérifier la compatibilité du métier
    const crafts = Array.isArray(employee.crafts) ? employee.crafts : [];
    if (!isCraftCompatibleWithStep(crafts, step.step_type as CoutureProductionStepType)) {
      return NextResponse.json(
        {
          error: `Le métier de cet employé (${crafts.join(", ")}) n'est pas qualifié pour l'étape ${step.step_type}.`,
        },
        { status: 400 }
      );
    }

    // 4. Mettre à jour l'étape
    const { data: updatedStep, error: updateStepErr } = await admin
      .from("couture_production_steps")
      .update({
        assigned_employee_id: employee.id,
        assigned_worker_user_id: employee.user_id || null,
        status: "IN_PROGRESS",
        started_at: new Date().toISOString(),
      })
      .eq("id", step.id)
      .select()
      .single();

    if (updateStepErr || !updatedStep) {
      return NextResponse.json({ error: "Impossible d'assigner l'ouvrier à l'étape." }, { status: 500 });
    }

    // 5. Mettre à jour la fiche
    await admin
      .from("couture_production_cards")
      .update({
        status: "IN_PRODUCTION",
        current_step: step.step_type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)
      .eq("tenant_id", context.tenantId);

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.production.assign_step",
      entityType: "couture_production_steps",
      entityId: step.id,
      metadata: {
        cardId,
        stepType: step.step_type,
        employeeId: employee.id,
        employeeName: employee.full_name,
      },
    });

    return NextResponse.json({
      success: true,
      step: updatedStep,
      message: `Étape ${step.step_type} assignée à ${employee.full_name}.`,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
