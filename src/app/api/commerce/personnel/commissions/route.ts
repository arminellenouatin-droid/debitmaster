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

    // 1. Fetch active employees
    const { data: employees, error: empErr } = await admin
      .from("commerce_employees")
      .select("id, user_id, first_name, last_name, phone, status")
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE");

    if (empErr) {
      console.error("[commissions.GET] employees error", empErr);
      return NextResponse.json({ error: "Impossible de charger les collaborateurs." }, { status: 500 });
    }

    // 2. Fetch targets for this month
    const { data: targets } = await admin
      .from("commerce_sales_targets")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("period_month", periodMonth);

    const targetMap = new Map((targets ?? []).map((t) => [t.employee_id, t]));

    // 3. Fetch saved commissions
    const { data: savedCommissions } = await admin
      .from("commerce_commissions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("period_month", periodMonth);

    const commMap = new Map((savedCommissions ?? []).map((c) => [c.employee_id, c]));

    // 4. Fetch paid orders for this month to calculate realized revenue
    const startOfMonth = `${periodMonth}-01T00:00:00.000Z`;
    // Approximate end of month
    const [yearStr, monthStr] = periodMonth.split("-");
    const nextMonth = Number(monthStr) === 12 ? 1 : Number(monthStr) + 1;
    const nextYear = Number(monthStr) === 12 ? Number(yearStr) + 1 : Number(yearStr);
    const endOfMonth = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`;

    const { data: orders } = await admin
      .from("orders")
      .select("id, total_amount, server_user_id, server_name, status, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", startOfMonth)
      .lt("created_at", endOfMonth)
      .in("status", ["PAID", "DELIVERED", "COMPLETED", "SERVED"]);

    // Map sales by server_user_id and by seller name
    const revenueByUserId = new Map<string, number>();
    const revenueByName = new Map<string, number>();

    for (const order of orders ?? []) {
      const amount = Number(order.total_amount) || 0;
      if (order.server_user_id) {
        revenueByUserId.set(order.server_user_id, (revenueByUserId.get(order.server_user_id) ?? 0) + amount);
      }
      if (order.server_name) {
        const key = order.server_name.trim().toLowerCase();
        revenueByName.set(key, (revenueByName.get(key) ?? 0) + amount);
      }
    }

    // 5. Build performance summaries
    const summaries = (employees ?? []).map((emp) => {
      const fullName = `${emp.first_name} ${emp.last_name}`.trim().toLowerCase();
      const revenue = (emp.user_id && revenueByUserId.get(emp.user_id)) || revenueByName.get(fullName) || 0;

      const target = targetMap.get(emp.id);
      const saved = commMap.get(emp.id);

      const targetAmount = target ? Number(target.target_revenue_xof) : 0;
      const ratePercent = target ? Number(target.commission_rate_percent) : 0;
      const commissionType = target?.commission_type ?? "REVENUE_PERCENT";
      const fixedBonus = target ? Number(target.fixed_bonus_xof) : 0;

      const achievementRate = targetAmount > 0 ? Number(((revenue / targetAmount) * 100).toFixed(2)) : 0;

      let calculatedCommission = 0;
      if (commissionType === "REVENUE_PERCENT") {
        calculatedCommission = Math.round(revenue * (ratePercent / 100));
      } else if (commissionType === "FIXED_BONUS") {
        calculatedCommission = revenue >= targetAmount && targetAmount > 0 ? fixedBonus : 0;
      } else {
        // MARGIN_PERCENT: fallback to estimated 20% margin if CMP not individually tracked
        calculatedCommission = Math.round(revenue * 0.20 * (ratePercent / 100));
      }

      return {
        employeeId: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name,
        phone: emp.phone,
        periodMonth,
        achievedRevenueXof: revenue,
        targetRevenueXof: targetAmount,
        achievementRatePercent: achievementRate,
        commissionRatePercent: ratePercent,
        commissionType,
        commissionAmountXof: saved?.commission_amount_xof ?? calculatedCommission,
        status: saved?.status ?? "PENDING",
        approvedAt: saved?.approved_at ?? null,
        paidAt: saved?.paid_at ?? null,
        notes: saved?.notes ?? null,
      };
    });

    return NextResponse.json({
      periodMonth,
      summaries,
      totalAchievedRevenue: summaries.reduce((acc, s) => acc + s.achievedRevenueXof, 0),
      totalCommissions: summaries.reduce((acc, s) => acc + s.commissionAmountXof, 0),
    });
  } catch (err) {
    console.error("[commissions.GET] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const periodMonth = typeof body.periodMonth === "string" ? body.periodMonth : "";
    const action = body.action; // 'approve' | 'pay' | 'cancel'
    const commissionAmountXof = Math.max(0, Math.floor(Number(body.commissionAmountXof) || 0));
    const achievedRevenueXof = Math.max(0, Math.floor(Number(body.achievedRevenueXof) || 0));
    const targetRevenueXof = Math.max(0, Math.floor(Number(body.targetRevenueXof) || 0));
    const notes = typeof body.notes === "string" ? body.notes : null;

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    if (!can(context, "commissions.manage") && !can(context, "team.manage")) {
      return NextResponse.json({ error: "Permission insuffisante pour valider ou payer les commissions." }, { status: 403 });
    }

    if (!employeeId || !periodMonth) {
      return NextResponse.json({ error: "Collaborateur et période requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    let newStatus = "PENDING";
    let approvedBy = null;
    let approvedAt = null;
    let paidAt = null;

    if (action === "approve") {
      newStatus = "APPROVED";
      approvedBy = context.user.id;
      approvedAt = now;
    } else if (action === "pay") {
      newStatus = "PAID";
      paidAt = now;
    } else if (action === "cancel") {
      newStatus = "CANCELLED";
    }

    const { data: record, error } = await admin
      .from("commerce_commissions")
      .upsert({
        tenant_id: tenantId,
        employee_id: employeeId,
        period_month: periodMonth,
        achieved_revenue_xof: achievedRevenueXof,
        target_revenue_xof: targetRevenueXof,
        achievement_rate_percent: targetRevenueXof > 0 ? Number(((achievedRevenueXof / targetRevenueXof) * 100).toFixed(2)) : 0,
        commission_amount_xof: commissionAmountXof,
        status: newStatus,
        approved_by: approvedBy,
        approved_at: approvedAt,
        paid_at: paidAt,
        notes,
        updated_at: now,
      }, { onConflict: "tenant_id, employee_id, period_month" })
      .select()
      .single();

    if (error) {
      console.error("[commissions.PATCH] error", error);
      return NextResponse.json({ error: "Impossible de mettre à jour la commission." }, { status: 500 });
    }

    return NextResponse.json({ commission: record, message: `Statut commission mis à jour : ${newStatus}` });
  } catch (err) {
    console.error("[commissions.PATCH] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}
