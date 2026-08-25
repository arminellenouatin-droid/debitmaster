// DebitManager staff dashboard: aucune métrique globale, uniquement les données de l’employé connecté.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET() {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.employeeId || context.role !== "SERVEUR" || !can(context, "orders.view")) return NextResponse.json({ error: "Cet espace est réservé aux serveurs et serveuses." }, { status: 403 });
    const tenantId = context.tenantIds[0];
    if (!tenantId) return NextResponse.json({ error: "Aucun établissement actif." }, { status: 404 });
    const [{ data: employee }, { data: assignments, error: assignmentError }, { data: orders, error: orderError }, { data: commissions, error: commissionError }] = await Promise.all([
      context.supabase.from("employees").select("id,first_name,last_name,position,service_start_time,service_end_time,rest_day").eq("id", context.employeeId).eq("tenant_id", tenantId).maybeSingle(),
      context.supabase.from("employee_table_assignments").select("id,table_id,dining_tables(id,label,zone,capacity,status)").eq("tenant_id", tenantId).eq("employee_id", context.employeeId).limit(100),
      context.supabase.from("orders").select("id,order_number,location_label,table_label,status,total_amount,currency,created_at,updated_at,payments(id,status,payment_method,amount,paid_at,created_at),order_items(id,product_id,product_name,quantity,unit_price,total_price,fulfillment_unit,preparation_status,prepared_at,received_by_user_id,received_at,delivered_at)").eq("tenant_id", tenantId).eq("server_user_id", context.user.id).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("employee_sales_commissions").select("id,order_id,base_amount,commission_rate,commission_amount,status,created_at").eq("tenant_id", tenantId).eq("employee_id", context.employeeId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (assignmentError || orderError || commissionError) return NextResponse.json({ error: "Impossible de charger votre activité." }, { status: 500 });
    const visibleOrders = orders ?? [];
    const sales = visibleOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
    const paidSales = visibleOrders.reduce((sum, order) => sum + (order.payments ?? []).filter((payment) => ["PAID", "SUCCESS"].includes(payment.status)).reduce((paymentSum, payment) => paymentSum + Number(payment.amount ?? 0), 0), 0);
    const commissionTotal = (commissions ?? []).reduce((sum, commission) => sum + (commission.commission_amount ?? 0), 0);
    return NextResponse.json({ employee, assignments: assignments ?? [], orders: visibleOrders, metrics: { sales, paidSales, orderCount: visibleOrders.length, commissionTotal }, commissions: commissions ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}
