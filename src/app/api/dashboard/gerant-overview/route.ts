// DebitManager Gérant: pilotage global d’un établissement, jamais une agrégation inter-tenant.
import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || !context.company) return NextResponse.json({ error: "Aucun établissement actif." }, { status: 404 });
    if (context.role !== "GERANT" && context.role !== "ADMINISTRATEUR" && !can(context, "reports.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter le pilotage Gérant." }, { status: 403 });
    const tenantId = context.tenantId;
    const rangeKey = new URL(request.url).searchParams.get("range") ?? "30d";
    const range = rangeKey === "today" ? 1 : rangeKey === "7d" ? 7 : rangeKey === "90d" ? 90 : 30;
    const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();
    const [employeesResult, ordersResult, paymentsResult, productsResult, tablesResult, commissionsResult] = await Promise.all([
      context.supabase.from("employees").select("id,user_id,first_name,last_name,phone,position,status,service_start_time,service_end_time,rest_day,employee_table_assignments(id,table_id,dining_tables(id,label,zone,capacity,status))").eq("tenant_id", tenantId).eq("position", "SERVEUR").is("deleted_at", null).order("first_name").limit(100),
      context.supabase.from("orders").select("id,order_number,server_user_id,server_name,table_label,status,total_amount,currency,received_by_user_id,received_at,delivered_by_user_id,delivered_at,created_at,updated_at,order_items(id,product_name,quantity,unit_price,total_price,fulfillment_unit,preparation_status,prepared_at,received_at,delivered_at)").eq("tenant_id", tenantId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      context.supabase.from("payments").select("id,order_id,amount,status,payment_method,paid_at,created_at").eq("tenant_id", tenantId).gte("created_at", since).limit(500),
      context.supabase.from("products").select("id,name,current_stock,alert_threshold,safety_threshold,product_type").eq("tenant_id", tenantId).is("deleted_at", null).order("name").limit(500),
      context.supabase.from("dining_tables").select("id,label,zone,status,capacity").eq("tenant_id", tenantId).is("deleted_at", null).order("zone").order("label").limit(200),
      context.supabase.from("employee_sales_commissions").select("id,employee_id,order_id,base_amount,commission_amount,status,created_at").eq("tenant_id", tenantId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    ]);
    if (employeesResult.error || ordersResult.error || paymentsResult.error || productsResult.error || tablesResult.error || commissionsResult.error) return NextResponse.json({ error: "Impossible de charger le pilotage Gérant." }, { status: 500 });
    const orders = ordersResult.data ?? [];
    const payments = paymentsResult.data ?? [];
    const products = productsResult.data ?? [];
    const commissions = commissionsResult.data ?? [];
    const confirmedPayments = payments.filter((payment) => String(payment.status).toUpperCase() === "SUCCEEDED");
    const revenue = orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
    const confirmedRevenue = confirmedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const lowStock = products.filter((product) => Number(product.current_stock ?? 0) <= Number(product.alert_threshold ?? 0));
    const serveuses = (employeesResult.data ?? []).map((employee) => {
      const employeeOrders = orders.filter((order) => order.server_user_id === employee.user_id);
      const employeeCommissions = commissions.filter((commission) => commission.employee_id === employee.id);
      const sales = employeeOrders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
      const employeeOrderIds = new Set(employeeOrders.map((order) => order.id));
      const paidSales = confirmedPayments.filter((payment) => employeeOrderIds.has(payment.order_id)).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      const paidOrderCount = employeeOrders.filter((order) => {
        const paid = confirmedPayments.filter((payment) => payment.order_id === order.id).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
        return paid >= Number(order.total_amount ?? 0);
      }).length;
      return { ...employee, sales, paidSales, remainingSales: Math.max(sales - paidSales, 0), orderCount: employeeOrders.length, paidOrderCount, deliveredCount: employeeOrders.filter((order) => order.status === "DELIVERED").length, commissionTotal: employeeCommissions.reduce((sum, commission) => sum + Number(commission.commission_amount ?? 0), 0), servedTables: [...new Set(employeeOrders.map((order) => order.table_label).filter(Boolean))] };
    });
    return NextResponse.json({ company: context.company, range, metrics: { revenue, confirmedRevenue, orderCount: orders.length, paidOrderCount: confirmedPayments.length, lowStockCount: lowStock.length, totalStockItems: products.length, occupiedTables: (tablesResult.data ?? []).filter((table) => table.status === "OCCUPIED").length, totalTables: (tablesResult.data ?? []).length }, serveuses, orders, payments, stock: products, lowStock, tables: tablesResult.data ?? [], commissions });
  } catch { return NextResponse.json({ error: "Service de pilotage Gérant temporairement indisponible." }, { status: 500 }); }
}
