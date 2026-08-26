// DebitManager affiliate commissions: une commission par paiement d’abonnement confirmé, sans doublon.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function issueAffiliateCommission(admin: SupabaseClient, tenantId: string, subscriptionPaymentId: string, amount: number) {
  const { data: company } = await admin.from("companies").select("affiliate_id").eq("id", tenantId).maybeSingle();
  if (!company?.affiliate_id) return;
  const { data: affiliate } = await admin.from("platform_affiliates").select("id,commission_rate,status").eq("id", company.affiliate_id).eq("status", "ACTIVE").maybeSingle();
  if (!affiliate) return;
  const commissionAmount = Math.floor(amount * Number(affiliate.commission_rate) / 100);
  await admin.from("affiliate_commissions").upsert({ affiliate_id: affiliate.id, tenant_id: tenantId, subscription_payment_id: subscriptionPaymentId, gross_amount: amount, commission_rate: affiliate.commission_rate, commission_amount: commissionAmount, currency: "XOF", status: "PENDING" }, { onConflict: "subscription_payment_id", ignoreDuplicates: true });
}
