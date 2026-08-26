// DebitManager owner cockpit: real tenant-scoped data, paid-sales ranking and purchase-cost gross margin.
import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { subscriptionDisplayStatus } from "@/lib/subscription-plans";

const paidStatuses = new Set(["PAID", "SUCCESS", "SUCCEEDED", "COMPLETED"]);
const dayMs = 24 * 60 * 60 * 1000;

type PaymentRow = { order_id: string; amount: number | null; status: string | null; created_at: string };
type OrderRow = { id: string; total_amount: number | null; status: string; server_name: string | null; server_user_id: string | null; table_label: string | null; location_label: string | null; created_at: string };
type ItemRow = { order_id: string; product_id: string | null; product_name: string | null; quantity: number; total_price: number | null };

function periodBounds(url: URL) {
  const range = url.searchParams.get("range") ?? "30d";
  const now = new Date();
  const end = url.searchParams.get("end") ? new Date(`${url.searchParams.get("end")}T23:59:59.999Z`) : now;
  let start: Date;
  if (range === "today") start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  else if (range === "7d") start = new Date(end.getTime() - 6 * dayMs);
  else if (range === "90d") start = new Date(end.getTime() - 89 * dayMs);
  else if (range === "custom" && url.searchParams.get("start")) start = new Date(`${url.searchParams.get("start")}T00:00:00.000Z`);
  else start = new Date(end.getTime() - 29 * dayMs);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return { start: new Date(Date.now() - 29 * dayMs), end: now, dayCount: 30 };
  return { start, end, dayCount: Math.min(Math.max(Math.floor((end.getTime() - start.getTime()) / dayMs) + 1, 1), 366) };
}

function normalizeName(name: string | null | undefined) {
  return name?.trim() || "Non attribué";
}

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || !context.company) return NextResponse.json({ error: "Aucun établissement actif." }, { status: 404 });
    if (!can(context, "reports.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter le pilotage." }, { status: 403 });

    const url = new URL(request.url);
    const { start, end, dayCount } = periodBounds(url);
    const tenantId = context.tenantId;
    const reportClient = createSupabaseAdminClient();
    const serverId = url.searchParams.get("serverId") ?? "";
    const zoneId = url.searchParams.get("zoneId") ?? "";
    const since = start.toISOString();
    const until = end.toISOString();

    const [ordersResult, paymentsResult, itemsResult, employeesResult, tablesResult, inventoryResult, purchasesResult] = await Promise.all([
      reportClient.from("orders").select("id,total_amount,status,server_name,server_user_id,table_label,location_label,created_at").eq("tenant_id", tenantId).gte("created_at", since).lte("created_at", until).order("created_at", { ascending: false }).limit(1000),
      can(context, "finance.view") ? reportClient.from("payments").select("order_id,amount,status,created_at").eq("tenant_id", tenantId).gte("created_at", since).lte("created_at", until).limit(2000) : Promise.resolve({ data: [], error: null }),
      reportClient.from("order_items").select("order_id,product_id,product_name,quantity,total_price").eq("tenant_id", tenantId).gte("created_at", since).lte("created_at", until).limit(4000),
      can(context, "team.view") ? reportClient.from("employees").select("id,user_id,first_name,last_name,position,status").eq("tenant_id", tenantId).is("deleted_at", null).limit(300) : Promise.resolve({ data: [], error: null }),
      can(context, "tables.view") ? reportClient.from("dining_tables").select("id,label,zone,zone_id,status").eq("tenant_id", tenantId).is("deleted_at", null).limit(400) : Promise.resolve({ data: [], error: null }),
      can(context, "stock.view") ? reportClient.from("store_inventory").select("product_id,quantity,reserved_quantity,inventory_stores!inner(id,name,is_active)").eq("tenant_id", tenantId).eq("inventory_stores.is_active", true).limit(2000) : Promise.resolve({ data: [], error: null }),
      can(context, "stock.view") ? reportClient.from("stock_purchases").select("product_id,purchase_unit_price,quantity,purchased_at").eq("tenant_id", tenantId).lte("purchased_at", until).limit(4000) : Promise.resolve({ data: [], error: null }),
    ]);

    if (ordersResult.error || paymentsResult.error || itemsResult.error || employeesResult.error || tablesResult.error || inventoryResult.error || purchasesResult.error) return NextResponse.json({ error: "Impossible de charger les indicateurs de l’établissement." }, { status: 500 });

    const allOrders = (ordersResult.data ?? []) as OrderRow[];
    const payments = (paymentsResult.data ?? []) as PaymentRow[];
    const itemRows = (itemsResult.data ?? []) as ItemRow[];
    const employees = employeesResult.data ?? [];
    const tables = tablesResult.data ?? [];
    const tableZoneByLabel = new Map<string, { id: string; name: string }>();
    const inventory = inventoryResult.data ?? [];
    const purchases = purchasesResult.data ?? [];
    for (const table of tables) {
      const zoneName = table.zone ?? "";
      if (table.label && zoneName) tableZoneByLabel.set(String(table.label), { id: String(table.zone_id ?? zoneName), name: String(zoneName) });
    }
    const orders = allOrders.filter((order) => {
      if (serverId && order.server_user_id !== serverId) return false;
      if (!zoneId) return true;
      const zone = order.table_label ? tableZoneByLabel.get(order.table_label) : null;
      return zone?.id === zoneId || zone?.name === zoneId || order.location_label === zoneId;
    });
    const orderIds = new Set(orders.map((order) => order.id));
    const filteredItems = itemRows.filter((item) => orderIds.has(item.order_id));
    const paidByOrder = new Map<string, number>();
    for (const payment of payments) if (paidStatuses.has(String(payment.status ?? "").toUpperCase()) && orderIds.has(payment.order_id)) paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) ?? 0) + Number(payment.amount ?? 0));

    const purchaseTotals = new Map<string, { quantity: number; value: number }>();
    for (const purchase of purchases) {
      const current = purchaseTotals.get(String(purchase.product_id)) ?? { quantity: 0, value: 0 };
      current.quantity += Number(purchase.quantity ?? 0);
      current.value += Number(purchase.quantity ?? 0) * Number(purchase.purchase_unit_price ?? 0);
      purchaseTotals.set(String(purchase.product_id), current);
    }
    const averageCostByProduct = new Map<string, number>();
    for (const [productId, total] of purchaseTotals) if (total.quantity > 0) averageCostByProduct.set(productId, total.value / total.quantity);

    const paidOrders = orders.filter((order) => (paidByOrder.get(order.id) ?? 0) >= Number(order.total_amount ?? 0));
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
    const confirmedRevenue = Array.from(paidByOrder.values()).reduce((sum, amount) => sum + amount, 0);
    const costOfGoodsSold = filteredItems.filter((item) => paidOrders.some((order) => order.id === item.order_id)).reduce((sum, item) => sum + (averageCostByProduct.get(String(item.product_id)) ?? 0) * Number(item.quantity ?? 0), 0);
    const stockByProduct = new Map<string, { quantity: number; reserved: number }>();
    for (const position of inventory) {
      const key = String(position.product_id);
      const current = stockByProduct.get(key) ?? { quantity: 0, reserved: 0 };
      current.quantity += Number(position.quantity ?? 0);
      current.reserved += Number(position.reserved_quantity ?? 0);
      stockByProduct.set(key, current);
    }
    const stockValue = Array.from(stockByProduct.entries()).reduce((sum, [productId, position]) => sum + position.quantity * (averageCostByProduct.get(productId) ?? 0), 0);
    const purchaseValue = purchases.filter((purchase) => new Date(purchase.purchased_at).getTime() >= start.getTime()).reduce((sum, purchase) => sum + Number(purchase.quantity ?? 0) * Number(purchase.purchase_unit_price ?? 0), 0);

    const agentMap = new Map<string, { name: string; orderCount: number; paidRevenue: number }>();
    for (const order of paidOrders) {
      const key = order.server_user_id ?? normalizeName(order.server_name);
      const current = agentMap.get(key) ?? { name: normalizeName(order.server_name), orderCount: 0, paidRevenue: 0 };
      current.orderCount += 1; current.paidRevenue += Number(order.total_amount ?? 0); agentMap.set(key, current);
    }
    const agentPerformance = Array.from(agentMap.values()).sort((a, b) => b.paidRevenue - a.paidRevenue).slice(0, 8);
    const dailyRevenue = Array.from({ length: dayCount }, (_, index) => {
      const day = new Date(start.getTime() + index * dayMs);
      const key = day.toISOString().slice(0, 10);
      return { date: key, amount: paidOrders.filter((order) => order.created_at.slice(0, 10) === key).reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0) };
    });
    const zoneOptions = Array.from(new Map(Array.from(tableZoneByLabel.values()).map((zone) => [zone.id, zone])).values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const serverOptions = employees.filter((employee) => ["SERVEUR", "BARMAN"].includes(String(employee.position))).map((employee) => ({ id: employee.user_id ?? employee.id, name: `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || "Serveur sans nom" }));
    const totalStockUnits = Array.from(stockByProduct.values()).reduce((sum, position) => sum + position.quantity, 0);
    const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE").length;
    const occupiedTables = tables.filter((table) => table.status === "OCCUPIED").length;

    return NextResponse.json({
      company: context.company,
      role: context.role,
      isOwner: context.tenantIds.includes(tenantId) && !context.employeeId,
      period: { range: url.searchParams.get("range") ?? "30d", start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
      filters: { servers: serverOptions, zones: zoneOptions },
      metrics: {
        revenue,
        confirmedRevenue,
        orderCount: orders.length,
        paidOrderCount: paidOrders.length,
        averageBasket: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
        activeEmployees,
        occupiedTables,
        totalTables: tables.length,
        stockUnits: totalStockUnits,
        stockValueAtPurchaseCost: Math.round(stockValue),
        purchasesValue: purchaseValue,
        costOfGoodsSold: Math.round(costOfGoodsSold),
        grossMargin: Math.round(revenue - costOfGoodsSold),
        expenses: { available: false, total: 0 },
      },
      agentPerformance,
      dailyRevenue,
      recentOrders: orders.slice(0, 8).map((order) => ({ ...order, paidAmount: paidByOrder.get(order.id) ?? 0 })),
      subscription: { status: subscriptionDisplayStatus(context.company.status, context.company.trial_ends_at, context.company.subscription_expires_at), plan: context.company.subscription_plan, trialEndsAt: context.company.trial_ends_at, expiresAt: context.company.subscription_expires_at },
    });
  } catch {
    return NextResponse.json({ error: "Service de pilotage temporairement indisponible." }, { status: 500 });
  }
}
