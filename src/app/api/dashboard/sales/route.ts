/* DebitManager Power sales report: independent tenant-scoped queries keep optional relations from blocking the report. */
import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paidStatuses = new Set(["PAID", "SUCCESS", "SUCCEEDED", "COMPLETED"]);
const dayMs = 24 * 60 * 60 * 1000;
const activityNames = ["Boissons", "Repas", "Gym", "Auberge", "Wi-Fi", "Lavage"];
type Order = { id: string; total_amount: number | null; server_name: string | null; server_user_id: string | null; created_at: string };
type Item = { order_id: string; quantity: number; total_price: number | null; fulfillment_unit: string | null };

function bounds(url: URL) {
  const range = url.searchParams.get("range") ?? "30d";
  const end = url.searchParams.get("end") ? new Date(`${url.searchParams.get("end")}T23:59:59.999Z`) : new Date();
  let start = new Date(end.getTime() - 29 * dayMs);
  if (range === "today") start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (range === "7d") start = new Date(end.getTime() - 6 * dayMs);
  if (range === "90d") start = new Date(end.getTime() - 89 * dayMs);
  if (range === "custom" && url.searchParams.get("start")) start = new Date(`${url.searchParams.get("start")}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return { start: new Date(Date.now() - 29 * dayMs), end: new Date(), dayCount: 30 };
  return { start, end, dayCount: Math.min(Math.max(Math.floor((end.getTime() - start.getTime()) / dayMs) + 1, 1), 366) };
}

function itemActivity(unit: string | null) { return String(unit).toUpperCase() === "MEAL" ? "Repas" : "Boissons"; }

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || !context.company) return NextResponse.json({ error: "Aucun établissement actif." }, { status: 404 });
    if (!(context.role === "ADMINISTRATEUR" || context.role === "SUPERVISEUR") || !can(context, "reports.view")) return NextResponse.json({ error: "Accès réservé au propriétaire ou au superviseur de l’établissement." }, { status: 403 });
    const url = new URL(request.url);
    const { start, end, dayCount } = bounds(url);
    const tenantId = context.tenantId;
    const reportClient = createSupabaseAdminClient();
    const since = start.toISOString();
    const until = end.toISOString();
    const [ordersResult, itemsResult, paymentsResult, employeesResult, activitiesResult] = await Promise.all([
      reportClient.from("orders").select("id,total_amount,server_name,server_user_id,created_at").eq("tenant_id", tenantId).gte("created_at", since).lte("created_at", until).order("created_at", { ascending: false }).limit(2000),
      reportClient.from("order_items").select("order_id,quantity,total_price,fulfillment_unit").eq("tenant_id", tenantId).gte("created_at", since).lte("created_at", until).limit(6000),
      reportClient.from("payments").select("order_id,amount,status,created_at").eq("tenant_id", tenantId).gte("created_at", since).lte("created_at", until).limit(4000),
      reportClient.from("employees").select("user_id,first_name,last_name,position,status").eq("tenant_id", tenantId).is("deleted_at", null).limit(500),
      reportClient.from("company_activities").select("id,name,is_active").eq("tenant_id", tenantId).order("name").limit(50),
    ]);
    if (ordersResult.error || itemsResult.error || paymentsResult.error || employeesResult.error || activitiesResult.error) {
      console.error("[dashboard.sales] query failed", { orders: ordersResult.error?.message, items: itemsResult.error?.message, payments: paymentsResult.error?.message, employees: employeesResult.error?.message, activities: activitiesResult.error?.message });
      return NextResponse.json({ error: "Impossible de charger le chiffre d’affaires.", diagnostic: "SALES_QUERY_FAILED" }, { status: 500 });
    }
    const orders = (ordersResult.data ?? []) as Order[];
    const items = (itemsResult.data ?? []) as Item[];
    const paidByOrder = new Map<string, number>();
    for (const payment of paymentsResult.data ?? []) if (paidStatuses.has(String(payment.status ?? "").toUpperCase())) paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) ?? 0) + Number(payment.amount ?? 0));
    const paidOrders = orders.filter((order) => (paidByOrder.get(order.id) ?? 0) >= Number(order.total_amount ?? 0));
    const paidIds = new Set(paidOrders.map((order) => order.id));
    const activityMap = new Map(activityNames.map((name) => [name, { name, amount: 0, orderCount: 0, units: 0 }]));
    const personMap = new Map<string, { name: string; amount: number; orderCount: number }>();
    for (const order of paidOrders) {
      const personKey = order.server_user_id ?? order.server_name ?? "unassigned";
      const person = personMap.get(personKey) ?? { name: order.server_name?.trim() || "Non attribué", amount: 0, orderCount: 0 };
      person.amount += Number(order.total_amount ?? 0); person.orderCount += 1; personMap.set(personKey, person);
    }
    for (const item of items) if (paidIds.has(item.order_id)) { const activity = activityMap.get(itemActivity(item.fulfillment_unit)); if (activity) { activity.amount += Number(item.total_price ?? 0); activity.units += Number(item.quantity ?? 0); activity.orderCount += 1; } }
    const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
    const daily = Array.from({ length: dayCount }, (_, index) => { const date = new Date(start.getTime() + index * dayMs).toISOString().slice(0, 10); return { date, amount: paidOrders.filter((order) => order.created_at.slice(0, 10) === date).reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0) }; });
    return NextResponse.json({ period: { range: url.searchParams.get("range") ?? "30d", start: since.slice(0, 10), end: until.slice(0, 10) }, metrics: { totalRevenue, paidOrderCount: paidOrders.length, averageBasket: paidOrders.length ? Math.round(totalRevenue / paidOrders.length) : 0 }, activities: [...activityMap.values()].map((item) => ({ ...item, note: item.amount === 0 && !["Boissons", "Repas"].includes(item.name) ? "Aucune vente enregistrée sur cette période" : undefined })), configuredActivities: (activitiesResult.data ?? []).map((activity) => activity.name), people: [...personMap.values()].sort((a, b) => b.amount - a.amount), peopleOptions: (employeesResult.data ?? []).map((employee) => ({ id: employee.user_id, name: `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || "Sans nom", position: employee.position })), daily });
  } catch (error) {
    console.error("[dashboard.sales] unexpected error", error);
    return NextResponse.json({ error: "Service de chiffre d’affaires temporairement indisponible." }, { status: 500 });
  }
}
