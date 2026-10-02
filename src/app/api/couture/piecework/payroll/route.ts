import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { computeWeeklyPayrollTotals } from "@/lib/couture-piecework";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const employeeId = searchParams.get("employeeId");
    const siteId = searchParams.get("siteId");
    const weekStartDate = searchParams.get("weekStartDate");
    const status = searchParams.get("status");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "payroll.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_weekly_payrolls")
      .select(`
        *,
        employee:couture_employees!employee_id (id, full_name, crafts, phone),
        site:couture_sites!site_id (id, name, currency)
      `)
      .eq("tenant_id", context.tenantId)
      .order("week_start_date", { ascending: false })
      .limit(100);

    if (employeeId) query = query.eq("employee_id", employeeId);
    if (siteId) query = query.eq("site_id", siteId);
    if (weekStartDate) query = query.eq("week_start_date", weekStartDate);
    if (status) query = query.eq("status", status);

    const { data: payrolls, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les décomptes de paie hebdomadaires." }, { status: 500 });
    }

    return NextResponse.json({ payrolls: payrolls ?? [] });
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

    assertCouturePermission(context, "payroll.calculate");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const weekStartDate = typeof body.weekStartDate === "string" ? body.weekStartDate.trim() : "";
    const weekEndDate = typeof body.weekEndDate === "string" ? body.weekEndDate.trim() : "";
    const bonusAmount = Math.max(0, Math.floor(Number(body.bonusAmountXof) || 0));
    const deductionAmount = Math.max(0, Math.floor(Number(body.deductionAmountXof) || 0));

    if (!employeeId || !siteId || !weekStartDate || !weekEndDate) {
      return NextResponse.json({ error: "Ouvrier, atelier, et dates de début et fin de semaine requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Récupérer les tâches accomplies par cet ouvrier sur la période
    const { data: tasks, error: taskErr } = await admin
      .from("couture_completed_tasks")
      .select("unit_rate_xof, is_overtime, final_amount_xof")
      .eq("tenant_id", context.tenantId)
      .eq("employee_id", employeeId)
      .gte("completed_date", weekStartDate)
      .lte("completed_date", weekEndDate);

    if (taskErr) {
      return NextResponse.json({ error: "Erreur lors de la récupération des tâches de l'ouvrier." }, { status: 500 });
    }

    const taskSummaries = (tasks ?? []).map((t) => ({
      unitRateXof: Number(t.unit_rate_xof) || 0,
      isOvertime: Boolean(t.is_overtime),
      finalAmountXof: Number(t.final_amount_xof) || 0,
    }));

    const totals = computeWeeklyPayrollTotals(taskSummaries, bonusAmount, deductionAmount);

    // 2. Enregistrer / mettre à jour le décompte hebdomadaire
    const { data: payroll, error: payrollErr } = await admin
      .from("couture_weekly_payrolls")
      .upsert(
        {
          tenant_id: context.tenantId,
          site_id: siteId,
          employee_id: employeeId,
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          tasks_count: totals.tasksCount,
          base_amount_xof: totals.baseAmountXof,
          overtime_amount_xof: totals.overtimeAmountXof,
          bonus_amount_xof: totals.bonusAmountXof,
          deduction_amount_xof: totals.deductionAmountXof,
          net_amount_xof: totals.netAmountXof,
          status: "DRAFT",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,employee_id,week_start_date" }
      )
      .select()
      .single();

    if (payrollErr || !payroll) {
      return NextResponse.json({ error: "Impossible de générer le décompte de paie hebdomadaire." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.payroll.calculate_weekly",
      entityType: "couture_weekly_payrolls",
      entityId: payroll.id,
      metadata: {
        employeeId,
        weekStartDate,
        weekEndDate,
        tasksCount: totals.tasksCount,
        netAmountXof: totals.netAmountXof,
      },
    });

    return NextResponse.json({ payroll, totals }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
