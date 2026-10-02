import { NextResponse } from "next/server";
import { getCoutureContext } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { calculateTaskAmount } from "@/lib/couture-piecework";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const employeeId = searchParams.get("employeeId");
    const siteId = searchParams.get("siteId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    // Un ouvrier peut consulter ses tâches (piecework.view), ou un gestionnaire/chef d'atelier
    const canView = context.permissions.has("piecework.view") || context.permissions.has("production.view");
    if (!canView) {
      return NextResponse.json({ error: "Permission requise pour consulter les tâches." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_completed_tasks")
      .select(`
        *,
        employee:couture_employees!employee_id (id, full_name, crafts),
        site:couture_sites!site_id (id, name)
      `)
      .eq("tenant_id", context.tenantId)
      .order("completed_date", { ascending: false })
      .limit(limit);

    if (employeeId) query = query.eq("employee_id", employeeId);
    if (siteId) query = query.eq("site_id", siteId);
    if (from) query = query.gte("completed_date", from);
    if (to) query = query.lte("completed_date", to);

    const { data: tasks, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les tâches réalisées." }, { status: 500 });
    }

    return NextResponse.json({ tasks: tasks ?? [] });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    const canDeclare = context.permissions.has("piecework.declare") || context.permissions.has("piecework.manage");
    if (!canDeclare) {
      return NextResponse.json({ error: "Permission requise pour déclarer une tâche." }, { status: 403 });
    }
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    const taskCode = typeof body.taskCode === "string" ? body.taskCode.trim().toUpperCase() : "";
    const hasEmbroidery = Boolean(body.hasEmbroidery);
    const isOvertime = Boolean(body.isOvertime);
    const cardId = typeof body.cardId === "string" ? body.cardId.trim() : null;
    const stepId = typeof body.stepId === "string" ? body.stepId.trim() : null;
    const completedDate = typeof body.completedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.completedDate)
      ? body.completedDate
      : new Date().toISOString().slice(0, 10);

    if (!siteId || !employeeId || !taskCode) {
      return NextResponse.json({ error: "Site, ouvrier et code tâche requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Charger l'employé
    const { data: employee } = await admin
      .from("couture_employees")
      .select("id, user_id, full_name")
      .eq("id", employeeId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (!employee) {
      return NextResponse.json({ error: "Ouvrier introuvable." }, { status: 404 });
    }

    // 2. Charger le barème pour cette tâche
    const { data: rateRow } = await admin
      .from("couture_piecework_rates")
      .select("task_label, rate_without_embroidery_xof, rate_with_embroidery_xof")
      .eq("tenant_id", context.tenantId)
      .eq("task_code", taskCode)
      .maybeSingle();

    const taskLabel = rateRow?.task_label || taskCode;
    const unitRate = hasEmbroidery
      ? Number(rateRow?.rate_with_embroidery_xof || body.unitRateXof || 0)
      : Number(rateRow?.rate_without_embroidery_xof || body.unitRateXof || 0);

    const finalAmount = calculateTaskAmount(unitRate, isOvertime, 1.2);

    // 3. Insérer la tâche accomplie avec capture immuable du tarif
    const { data: completedTask, error: insertErr } = await admin
      .from("couture_completed_tasks")
      .insert({
        tenant_id: context.tenantId,
        site_id: siteId,
        employee_id: employee.id,
        worker_user_id: employee.user_id || context.user.id,
        card_id: cardId,
        step_id: stepId,
        task_code: taskCode,
        task_label: taskLabel,
        has_embroidery: hasEmbroidery,
        unit_rate_xof: unitRate,
        is_overtime: isOvertime,
        overtime_multiplier: isOvertime ? 1.2 : 1.0,
        final_amount_xof: finalAmount,
        validated_by_supervisor: context.permissions.has("piecework.manage"),
        supervisor_user_id: context.permissions.has("piecework.manage") ? context.user.id : null,
        completed_date: completedDate,
      })
      .select()
      .single();

    if (insertErr || !completedTask) {
      return NextResponse.json({ error: "Impossible d'enregistrer la tâche accomplie." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.piecework.task_declare",
      entityType: "couture_completed_tasks",
      entityId: completedTask.id,
      metadata: {
        taskCode,
        employeeId: employee.id,
        unitRate,
        isOvertime,
        finalAmount,
        completedDate,
      },
    });

    return NextResponse.json({ task: completedTask }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
