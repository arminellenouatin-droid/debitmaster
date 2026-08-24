// DebitManager owner dashboard: metrics are computed from tenant-scoped rows and never fabricated.
import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { can } from "@/lib/authorization";

function subscriptionLabel(status: string, trialEndsAt: string | null) {
  const normalized = status.toUpperCase();
  if (trialEndsAt && new Date(trialEndsAt).getTime() < Date.now()) return "Expiré";
  if (["ACTIVE", "SUBSCRIBED", "PAID"].includes(normalized)) return "Activé";
  return "Gratuit";
}

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || !context.company) return NextResponse.json({ error: "Aucun établissement actif." }, { status: 404 });
    if (!can(context, "reports.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter le pilotage." }, { status: 403 });

    const url = new URL(request.url);
    const range = url.searchParams.get("range") === "7d" ? 7 : 30;
    const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();
    const tenantId = context.tenantId;

    const [ordersResult, employeesResult, tablesResult, paymentsResult] = await Promise.all([
      context.supabase.from("orders").select("id,total_amount,status,server_name,created_at").eq("tenant_id", tenantId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      can(context, "team.view") ? context.supabase.from("employees").select("id,status,position").eq("tenant_id", tenantId).is("deleted_at", null).limit(200) : Promise.resolve({ data: [], error: null }),
      can(context, "tables.view") ? context.supabase.from("dining_tables").select("id,status").eq("tenant_id", tenantId).is("deleted_at", null).limit(200) : Promise.resolve({ data: [], error: null }),
      can(context, "finance.view") ? context.supabase.from("payments").select("id,amount,status,created_at").eq("tenant_id", tenantId).gte("created_at", since).limit(500) : Promise.resolve({ data: [], error: null }),
    ]);

    if (ordersResult.error) return NextResponse.json({ error: "Impossible de charger les indicateurs de commandes." }, { status: 500 });
    if (employeesResult.error || tablesResult.error || paymentsResult.error) return NextResponse.json({ error: "Impossible de charger les indicateurs de l’établissement." }, { status: 500 });

    const orders = ordersResult.data ?? [];
    const employees = employeesResult.data ?? [];
    const tables = tablesResult.data ?? [];
    const payments = paymentsResult.data ?? [];
    const revenue = orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
    const confirmedRevenue = payments.filter((payment) => ["PAID", "SUCCESS", "COMPLETED"].includes(String(payment.status).toUpperCase())).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE").length;
    const occupiedTables = tables.filter((table) => table.status === "OCCUPIED").length;
    const ordersByAgent = orders.reduce<Record<string, number>>((accumulator, order) => {
      const name = order.server_name?.trim() || "Non attribué";
      accumulator[name] = (accumulator[name] ?? 0) + 1;
      return accumulator;
    }, {});
    const agentPerformance = Object.entries(ordersByAgent).map(([name, orderCount]) => ({ name, orderCount })).sort((a, b) => b.orderCount - a.orderCount).slice(0, 6);
    const dailyRevenue = Array.from({ length: range }, (_, index) => {
      const day = new Date(Date.now() - (range - 1 - index) * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      return { date: key, amount: orders.filter((order) => order.created_at.slice(0, 10) === key).reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0) };
    });

    return NextResponse.json({
      company: context.company,
      role: context.role,
      isOwner: context.tenantIds.includes(tenantId) && !context.employeeId,
      metrics: {
        revenue,
        confirmedRevenue,
        orderCount: orders.length,
        averageBasket: orders.length ? Math.round(revenue / orders.length) : 0,
        activeEmployees,
        occupiedTables,
        totalTables: tables.length,
      },
      agentPerformance,
      dailyRevenue,
      recentOrders: orders.slice(0, 6),
      subscription: {
        status: subscriptionLabel(context.company.status, context.company.trial_ends_at),
        trialEndsAt: context.company.trial_ends_at,
      },
    });
  } catch {
    return NextResponse.json({ error: "Service de pilotage temporairement indisponible." }, { status: 500 });
  }
}
