// Design Read: dashboard affilié responsive, chiffres lisibles, états financiers explicites et aucune donnée d’un autre affilié.
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthorizationContext } from "@/lib/authorization";

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const context = await getAuthorizationContext();
  if (!context.user) return fail("Authentification requise", 401);
  if (!context.affiliateId) return fail("Accès affilié requis", 403);
  const admin = createSupabaseAdminClient();
  const [{ data: affiliate }, { data: attributions, error: attributionError }, { data: commissions, error: commissionsError }, { data: payouts, error: payoutsError }] = await Promise.all([
    admin.from("platform_affiliates").select("id,code,display_name,commission_rate,payout_threshold_xof,status").eq("id", context.affiliateId).maybeSingle(),
    admin.from("affiliate_attributions").select("tenant_id,attribution_code,attributed_at").eq("affiliate_id", context.affiliateId).order("attributed_at", { ascending: false }).limit(500),
    admin.from("affiliate_commissions").select("id,tenant_id,subscription_payment_id,gross_amount,commission_rate,commission_amount,currency,status,created_at,paid_at").eq("affiliate_id", context.affiliateId).order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_payout_requests").select("id,amount,currency,status,payment_method,requested_at,reviewed_at,rejection_reason").eq("affiliate_id", context.affiliateId).order("requested_at", { ascending: false }).limit(200),
  ]);
  if (!affiliate || attributionError || commissionsError || payoutsError) return fail("Lecture du dashboard affilié impossible", 500);
  const tenantIds = (attributions ?? []).map((attribution) => attribution.tenant_id);
  const { data: companies } = tenantIds.length ? await admin.from("companies").select("id,name,status,created_at,affiliate_id").in("id", tenantIds).limit(500) : { data: [] };
  const approved = (commissions ?? []).filter((commission) => ["APPROVED", "PAID"].includes(commission.status)).reduce((sum, commission) => sum + Number(commission.commission_amount), 0);
  const reserved = (payouts ?? []).filter((payout) => ["PENDING", "APPROVED", "PAID"].includes(payout.status)).reduce((sum, payout) => sum + Number(payout.amount), 0);
  return NextResponse.json({ affiliate, metrics: { establishments: companies?.length ?? 0, approvedCommissionXof: approved, reservedPayoutXof: reserved, availableCommissionXof: Math.max(approved - reserved, 0) }, establishments: companies ?? [], attributions: attributions ?? [], commissions: commissions ?? [], payouts: payouts ?? [] });
}

export async function POST(request: Request) {
  const context = await getAuthorizationContext();
  if (!context.user) return fail("Authentification requise", 401);
  if (!context.affiliateId) return fail("Accès affilié requis", 403);
  const body = await request.json().catch(() => null) as { amount?: number; paymentMethod?: string; paymentAccountRef?: string } | null;
  const amount = Number(body?.amount);
  if (!Number.isInteger(amount) || amount < 20000) return fail("Le montant minimum est de 20 000 XOF");
  const paymentMethod = body?.paymentMethod;
  if (paymentMethod !== "MOBILE_MONEY" && paymentMethod !== "BANK_TRANSFER") return fail("Mode de paiement invalide");
  const paymentAccountRef = body?.paymentAccountRef?.trim();
  if (!paymentAccountRef || paymentAccountRef.length < 6) return fail("Référence de paiement invalide");
  const { data: requestId, error } = await context.supabase.rpc("create_affiliate_payout_request", { p_amount: amount, p_payment_method: paymentMethod, p_payment_account_ref: paymentAccountRef });
  if (error) {
    const message = error.message.includes("INSUFFICIENT") ? "Solde de commission disponible insuffisant" : error.message.includes("INVALID") ? "Demande de paiement invalide" : "Impossible d’enregistrer la demande";
    return fail(message, 400);
  }
  return NextResponse.json({ requestId, status: "PENDING" }, { status: 201 });
}
