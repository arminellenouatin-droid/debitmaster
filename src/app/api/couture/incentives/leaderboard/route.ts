import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  evaluateAnnualRewards,
  defaultCoutureIncentiveConfig,
} from "@/lib/couture-staff-incentives";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const periodYear = searchParams.get("periodYear") || String(new Date().getFullYear());
    const periodMonth = searchParams.get("periodMonth"); // si omis, classement annuel

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
        employee:couture_employees!employee_id (id, full_name, email, phone, created_at),
        site:couture_sites!site_id (id, name, city)
      `)
      .eq("tenant_id", context.tenantId)
      .eq("period_year", Number(periodYear));

    if (periodMonth) {
      query = query.eq("period_month", Number(periodMonth));
    }

    const { data: records, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Impossible de charger le classement des vendeurs." }, { status: 500 });
    }

    // Agréger par employé si annuel
    const employeeMap = new Map<string, {
      employeeId: string;
      fullName: string;
      email: string;
      siteName: string;
      siteCity: string;
      totalSalesXof: number;
      totalPoints: number;
      highTicketBonusesXof: number;
      seniorityYears: number;
    }>();

    for (const r of records ?? []) {
      const emp = (r as any).employee;
      const site = (r as any).site;
      const empId = r.employee_id;

      // Ancienneté estimée
      const empCreatedAt = emp?.created_at ? new Date(emp.created_at).getTime() : Date.now();
      const seniorityYears = Math.max(0, (Date.now() - empCreatedAt) / (365.25 * 24 * 3600 * 1000));

      const existing = employeeMap.get(empId) || {
        employeeId: empId,
        fullName: emp?.full_name || "Vendeur",
        email: emp?.email || "",
        siteName: site?.name || "Boutique",
        siteCity: site?.city || "",
        totalSalesXof: 0,
        totalPoints: 0,
        highTicketBonusesXof: 0,
        seniorityYears,
      };

      existing.totalSalesXof += Number(r.total_sales_xof) || 0;
      existing.totalPoints += Number(r.total_points) || 0;
      existing.highTicketBonusesXof += Number(r.high_ticket_bonuses_xof) || 0;

      employeeMap.set(empId, existing);
    }

    const rankedSellers = Array.from(employeeMap.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((s, index) => {
        const annualReward = evaluateAnnualRewards(s.totalPoints, s.seniorityYears, defaultCoutureIncentiveConfig);
        return {
          rank: index + 1,
          ...s,
          annualReward,
        };
      });

    // Classement par site
    const siteAggregation = new Map<string, { siteName: string; siteCity: string; totalSalesXof: number; totalPoints: number }>();
    for (const s of rankedSellers) {
      const siteKey = s.siteName;
      const cur = siteAggregation.get(siteKey) || { siteName: s.siteName, siteCity: s.siteCity, totalSalesXof: 0, totalPoints: 0 };
      cur.totalSalesXof += s.totalSalesXof;
      cur.totalPoints += s.totalPoints;
      siteAggregation.set(siteKey, cur);
    }

    const rankedSites = Array.from(siteAggregation.values())
      .sort((a, b) => b.totalSalesXof - a.totalSalesXof)
      .map((st, idx) => ({ rank: idx + 1, ...st }));

    return NextResponse.json({
      periodYear: Number(periodYear),
      periodMonth: periodMonth ? Number(periodMonth) : null,
      leaderboard: rankedSellers,
      sitesLeaderboard: rankedSites,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
