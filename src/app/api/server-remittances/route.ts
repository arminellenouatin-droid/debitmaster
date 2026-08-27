import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

const paidStatuses = ["SUCCEEDED", "PAID", "SUCCESS"];
const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function financialSnapshot(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string, serverUserId: string) {
  const { data: orders, error: ordersError } = await context.supabase.from("orders").select("id,total_amount,server_user_id,payments(amount,payment_method,status)").eq("tenant_id", tenantId).eq("server_user_id", serverUserId).limit(500);
  if (ordersError) throw ordersError;
  const { data: remittances, error: remittancesError } = await context.supabase.from("server_cash_remittances").select("id,expected_cash_amount,declared_mobile_amount,declared_cash_amount,received_cash_amount,discrepancy_type,discrepancy_amount,status,submitted_at,confirmed_at,note").eq("tenant_id", tenantId).eq("server_user_id", serverUserId).order("submitted_at", { ascending: false }).limit(100);
  if (remittancesError) throw remittancesError;
  let cash = 0;
  let mobile = 0;
  for (const order of orders ?? []) for (const payment of (order.payments ?? []) as { amount?: number; payment_method?: string; status?: string }[]) if (paidStatuses.includes(payment.status ?? "")) {
    if (payment.payment_method === "CASH") cash += Number(payment.amount ?? 0);
    if (payment.payment_method === "MOBILE_MONEY") mobile += Number(payment.amount ?? 0);
  }
  const accepted = (remittances ?? []).filter((item) => item.status === "ACCEPTED");
  const receivedCash = accepted.reduce((sum, item) => sum + Number(item.received_cash_amount ?? 0), 0);
  const shortages = accepted.filter((item) => item.discrepancy_type === "SHORTAGE").reduce((sum, item) => sum + Number(item.discrepancy_amount ?? 0), 0);
  const pending = (remittances ?? []).find((item) => item.status === "SUBMITTED") ?? null;
  const cashBalance = Math.max(cash - receivedCash - shortages, 0);
  return { sales: (orders ?? []).reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0), cash, mobile, receivedCash, shortages, cashBalance, pending, remittances: remittances ?? [] };
}

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return jsonError("Authentification requise.", 401);
    const params = new URL(request.url).searchParams;
    const tenantId = params.get("tenantId") ?? context.tenantIds[0] ?? "";
    if (!tenantId || !context.tenantIds.includes(tenantId)) return jsonError("Établissement non autorisé.", 403);
    const isManager = can(context, "finance.view");
    const serverUserId = isManager ? (params.get("serverUserId") ?? "") : context.user.id;
    if (!serverUserId) {
      const { data: employees } = await context.supabase.from("employees").select("id,user_id,first_name,last_name").eq("tenant_id", tenantId).eq("position", "SERVEUR").eq("status", "ACTIVE").limit(100);
      const entries = await Promise.all((employees ?? []).filter((employee) => employee.user_id).map(async (employee) => ({ employee, snapshot: await financialSnapshot(context, tenantId, employee.user_id!) })));
      return NextResponse.json({ entries });
    }
    const snapshot = await financialSnapshot(context, tenantId, serverUserId);
    return NextResponse.json({ snapshot });
  } catch {
    return jsonError("Impossible de charger le suivi financier de la Serveuse.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const declaredMobileAmount = Number(body.declaredMobileAmount ?? 0);
    const declaredCashAmount = Number(body.declaredCashAmount ?? 0);
    const context = await getAuthorizationContext();
    if (!context.user) return jsonError("Authentification requise.", 401);
    if (!tenantId || !context.tenantIds.includes(tenantId) || context.role !== "SERVEUR" || !context.employeeId || !can(context, "orders.create")) return jsonError("Cette opération est réservée à la Serveuse de cet établissement.", 403);
    if (![declaredMobileAmount, declaredCashAmount].every((amount) => Number.isInteger(amount) && amount >= 0)) return jsonError("Les montants déclarés sont invalides.");
    const snapshot = await financialSnapshot(context, tenantId, context.user.id);
    if (snapshot.pending) return jsonError("Un reversement est déjà en attente de validation.", 409);
    const { data, error } = await context.supabase.from("server_cash_remittances").insert({ tenant_id: tenantId, employee_id: context.employeeId, server_user_id: context.user.id, expected_cash_amount: snapshot.cashBalance, declared_mobile_amount: declaredMobileAmount, declared_cash_amount: declaredCashAmount, submitted_by: context.user.id }).select("id,expected_cash_amount,declared_mobile_amount,declared_cash_amount,status,submitted_at").single();
    if (error) return jsonError("Impossible d’enregistrer le reversement.", 500);
    return NextResponse.json({ remittance: data }, { status: 201 });
  } catch {
    return jsonError("Requête de reversement invalide.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const remittanceId = typeof body.remittanceId === "string" ? body.remittanceId : "";
    const receivedCashAmount = Number(body.receivedCashAmount ?? 0);
    const context = await getAuthorizationContext();
    if (!context.user) return jsonError("Authentification requise.", 401);
    if (!tenantId || !context.tenantIds.includes(tenantId) || !can(context, "finance.view")) return jsonError("Permission insuffisante pour valider ce reversement.", 403);
    if (!remittanceId || !Number.isInteger(receivedCashAmount) || receivedCashAmount < 0) return jsonError("Montant reçu invalide.");
    const discrepancyType = typeof body.discrepancyType === "string" ? body.discrepancyType : null;
    const { data, error } = await context.supabase.rpc("confirm_server_cash_remittance", { p_remittance_id: remittanceId, p_received_cash_amount: receivedCashAmount, p_discrepancy_type: discrepancyType, p_note: typeof body.note === "string" ? body.note.slice(0, 500) : null });
    if (error) {
      const message = error.message.includes("DISCREPANCY_TYPE_REQUIRED") ? "Choisissez si l’écart est un solde restant ou un manquant." : error.message.includes("REMITTANCE_ALREADY_PROCESSED") ? "Ce reversement est déjà traité." : "Impossible de valider le reversement.";
      return jsonError(message, 409);
    }
    return NextResponse.json({ remittance: data });
  } catch {
    return jsonError("Requête de validation invalide.");
  }
}
