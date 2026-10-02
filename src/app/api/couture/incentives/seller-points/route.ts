import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import {
  calculateSaleIncentives,
  evaluateMonthlySellerAlert,
  type CoutureIncentiveConfig,
  defaultCoutureIncentiveConfig,
} from "@/lib/couture-staff-incentives";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const periodYear = searchParams.get("periodYear") || String(new Date().getFullYear());
    const periodMonth = searchParams.get("periodMonth") || String(new Date().getMonth() + 1);
    const employeeId = searchParams.get("employeeId");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "incentives.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_seller_points")
      .select(`
        *,
        employee:couture_employees!employee_id (id, full_name, email),
        site:couture_sites!site_id (id, name, city)
      `)
      .eq("tenant_id", context.tenantId)
      .eq("period_year", Number(periodYear))
      .eq("period_month", Number(periodMonth))
      .order("total_points", { ascending: false });

    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data: points, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Impossible de charger les points des vendeurs." }, { status: 500 });
    }

    return NextResponse.json({ points: points ?? [] });
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

    const canRecord = context.permissions.has("sales.create") || context.permissions.has("incentives.manage");
    if (!canRecord) {
      return NextResponse.json({ error: "Permission requise pour créditer les points de vente." }, { status: 403 });
    }

    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : null;
    const saleAmount = Math.max(0, Math.round(Number(body.saleAmountXof) || 0));
    const now = new Date();
    const periodYear = Number(body.periodYear) || now.getFullYear();
    const periodMonth = Number(body.periodMonth) || now.getMonth() + 1;

    if (!employeeId || saleAmount <= 0) {
      return NextResponse.json({ error: "Employé vendeur et montant de vente valides requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Charger la config personnalisée ou défaut
    const { data: configRow } = await admin
      .from("couture_sales_incentives_config")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

    const config: CoutureIncentiveConfig = configRow
      ? {
          pointsPerStepXof: configRow.points_per_step_xof,
          weeklyTopSellerBonusXof: configRow.weekly_top_seller_bonus_xof,
          monthlyTopSellerBonusXof: configRow.monthly_top_seller_bonus_xof,
          highTicketThresholdXof: configRow.high_ticket_threshold_xof,
          highTicketBonusRate: Number(configRow.high_ticket_bonus_rate),
          lowPerformancePointsThreshold: configRow.low_performance_points_threshold,
          annualTop1MinPoints: configRow.annual_top1_min_points,
          annualTop2MinPoints: configRow.annual_top2_min_points,
        }
      : defaultCoutureIncentiveConfig;

    // 2. Calcul des points de cette vente
    const calc = calculateSaleIncentives(saleAmount, config);

    // 3. Récupérer ou initialiser la fiche de points du vendeur
    const { data: existingPoints } = await admin
      .from("couture_seller_points")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("employee_id", employeeId)
      .eq("period_year", periodYear)
      .eq("period_month", periodMonth)
      .maybeSingle();

    const newTotalSales = (existingPoints?.total_sales_xof || 0) + saleAmount;
    const newTotalPoints = (existingPoints?.total_points || 0) + calc.pointsEarned;
    const newHighTicketBonuses = (existingPoints?.high_ticket_bonuses_xof || 0) + calc.highTicketBonusXof;

    // Évaluation alertes mensuelles
    const alertEvaluation = evaluateMonthlySellerAlert(newTotalPoints, null, config.lowPerformancePointsThreshold);

    const { data: updatedPoints, error: upsertErr } = await admin
      .from("couture_seller_points")
      .upsert({
        tenant_id: context.tenantId,
        employee_id: employeeId,
        site_id: siteId,
        period_year: periodYear,
        period_month: periodMonth,
        total_sales_xof: newTotalSales,
        total_points: newTotalPoints,
        high_ticket_bonuses_xof: newHighTicketBonuses,
        alert_level: alertEvaluation.alertLevel,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "tenant_id, employee_id, period_year, period_month",
      })
      .select()
      .single();

    if (upsertErr || !updatedPoints) {
      return NextResponse.json({ error: "Erreur lors de l'enregistrement des points vendeur." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.incentives.points_award",
      entityType: "couture_seller_points",
      entityId: updatedPoints.id,
      metadata: {
        employeeId,
        saleAmount,
        pointsEarned: calc.pointsEarned,
        isHighTicket: calc.isHighTicket,
        highTicketBonusXof: calc.highTicketBonusXof,
        newTotalPoints,
      },
    });

    return NextResponse.json({
      success: true,
      pointsEarned: calc.pointsEarned,
      isHighTicket: calc.isHighTicket,
      highTicketBonusXof: calc.highTicketBonusXof,
      sellerPoints: updatedPoints,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
