import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? "";
    const periodMonth = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    if (!can(context, "commissions.view") && !can(context, "team.view")) {
      return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    const { data: targets, error } = await admin
      .from("commerce_sales_targets")
      .select(`
        id, tenant_id, employee_id, period_month, target_revenue_xof,
        commission_rate_percent, commission_type, fixed_bonus_xof, created_at, updated_at,
        commerce_employees (id, first_name, last_name, phone, status)
      `)
      .eq("tenant_id", tenantId)
      .eq("period_month", periodMonth);

    if (error) {
      console.error("[targets.GET] error", error);
      return NextResponse.json({ error: "Impossible de charger les objectifs." }, { status: 500 });
    }

    return NextResponse.json({ targets: targets ?? [] });
  } catch (err) {
    console.error("[targets.GET] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const periodMonth = typeof body.periodMonth === "string" ? body.periodMonth : new Date().toISOString().slice(0, 7);
    const targetRevenueXof = Math.max(0, Math.floor(Number(body.targetRevenueXof) || 0));
    const commissionRatePercent = Math.min(100, Math.max(0, Number(body.commissionRatePercent) || 0));
    const commissionType = ["REVENUE_PERCENT", "MARGIN_PERCENT", "FIXED_BONUS"].includes(body.commissionType)
      ? body.commissionType
      : "REVENUE_PERCENT";
    const fixedBonusXof = Math.max(0, Math.floor(Number(body.fixedBonusXof) || 0));

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    if (!can(context, "commissions.manage") && !can(context, "team.manage")) {
      return NextResponse.json({ error: "Permission insuffisante pour définir les objectifs." }, { status: 403 });
    }

    if (!employeeId || !periodMonth.match(/^[0-9]{4}-(0[1-9]|1[0-2])$/)) {
      return NextResponse.json({ error: "Employé et période valide (AAAA-MM) requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: target, error } = await admin
      .from("commerce_sales_targets")
      .upsert({
        tenant_id: tenantId,
        employee_id: employeeId,
        period_month: periodMonth,
        target_revenue_xof: targetRevenueXof,
        commission_rate_percent: commissionRatePercent,
        commission_type: commissionType,
        fixed_bonus_xof: fixedBonusXof,
        created_by: context.user.id,
        updated_at: now,
      }, { onConflict: "tenant_id, employee_id, period_month" })
      .select()
      .single();

    if (error) {
      console.error("[targets.POST] error", error);
      return NextResponse.json({ error: "Impossible d'enregistrer l'objectif." }, { status: 500 });
    }

    return NextResponse.json({ target, message: "Objectif de vente configuré avec succès." });
  } catch (err) {
    console.error("[targets.POST] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}
