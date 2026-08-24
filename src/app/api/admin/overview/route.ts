// Design Read: back-office financier desktop-first, dense mais lisible, mêmes tokens DebitManager, aucune donnée client exposée au navigateur sans autorisation master.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";

const jsonError = (message: string, status = 403) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const context = await getAuthorizationContext();
  if (!context.user) return jsonError("Authentification requise", 401);
  if (!context.isPlatformAdmin) return jsonError("Accès super-administration requis");

  const [{ data: companies, error: companiesError }, { data: subscriptionPayments, error: paymentsError }, { data: affiliates, error: affiliatesError }, { data: payoutRequests, error: payoutsError }] = await Promise.all([
    context.supabase.from("companies").select("id,name,activity_type,status,currency,created_at,affiliate_id").is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
    context.supabase.from("saas_subscription_payments").select("id,tenant_id,plan,amount,currency,status,paid_at,created_at").order("created_at", { ascending: false }).limit(1000),
    context.supabase.from("platform_affiliates").select("id,user_id,code,display_name,commission_rate,status,payout_threshold_xof,created_at").order("created_at", { ascending: false }).limit(500),
    context.supabase.from("affiliate_payout_requests").select("id,affiliate_id,amount,currency,status,payment_method,requested_at,reviewed_at,rejection_reason").order("requested_at", { ascending: false }).limit(500),
  ]);
  if (companiesError || paymentsError || affiliatesError || payoutsError) return jsonError("Lecture du cockpit SaaS impossible", 500);

  const succeeded = (subscriptionPayments ?? []).filter((payment) => payment.status === "SUCCEEDED");
  const revenue = succeeded.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const pendingCommissions = await context.supabase.from("affiliate_commissions").select("commission_amount,status").in("status", ["PENDING", "APPROVED"]).limit(1000);
  const pendingCommissionAmount = (pendingCommissions.data ?? []).reduce((sum, commission) => sum + Number(commission.commission_amount ?? 0), 0);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    metrics: {
      establishments: companies?.length ?? 0,
      activeEstablishments: companies?.filter((company) => ["ACTIVE", "TRIAL", "GRACE_PERIOD"].includes(company.status)).length ?? 0,
      subscriptionRevenueXof: revenue,
      succeededSubscriptions: succeeded.length,
      pendingCommissionXof: pendingCommissionAmount,
      pendingPayouts: payoutRequests?.filter((request) => request.status === "PENDING").length ?? 0,
    },
    companies: companies ?? [],
    subscriptionPayments: subscriptionPayments ?? [],
    affiliates: affiliates ?? [],
    payoutRequests: payoutRequests ?? [],
  });
}
