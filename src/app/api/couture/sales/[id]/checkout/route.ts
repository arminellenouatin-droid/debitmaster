import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { resolvePaymentStatus } from "@/lib/couture-sales";
import {
  calculateMultiCurrencyCheckout,
  defaultExchangeRates,
  type CoutureExchangeRates,
  type MultiCurrencyCashInput,
  type OtherPaymentInput,
} from "@/lib/couture-multi-currency";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id: saleId } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sales.multi_currency");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Récupérer la vente
    const { data: sale, error: saleErr } = await admin
      .from("couture_sales")
      .select("id, site_id, sale_number, total_amount_xof, paid_amount_xof, balance_amount_xof, status")
      .eq("id", saleId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (saleErr || !sale) {
      return NextResponse.json({ error: "Vente introuvable." }, { status: 404 });
    }

    if (sale.balance_amount_xof <= 0 || sale.status === "PAID") {
      return NextResponse.json({ error: "Cette facture est déjà intégralement soldée." }, { status: 400 });
    }

    // 2. Charger les taux de change applicables
    const today = new Date().toISOString().slice(0, 10);
    const { data: ratesRows } = await admin
      .from("couture_exchange_rates")
      .select("currency, rate_to_fcfa")
      .eq("tenant_id", context.tenantId)
      .lte("effective_date", today)
      .order("effective_date", { ascending: false });

    let currentRates: CoutureExchangeRates = { ...defaultExchangeRates };
    if (ratesRows && ratesRows.length > 0) {
      const eur = ratesRows.find((r) => r.currency === "EUR");
      if (eur && Number(eur.rate_to_fcfa) > 0) currentRates.eurToFcfa = Number(eur.rate_to_fcfa);
      const usd = ratesRows.find((r) => r.currency === "USD");
      if (usd && Number(usd.rate_to_fcfa) > 0) currentRates.usdToFcfa = Number(usd.rate_to_fcfa);
    }

    // 3. Calcul de l'encaissement
    const cashInput: MultiCurrencyCashInput = body.cash && typeof body.cash === "object" ? body.cash : {};
    const otherPaymentsInput: OtherPaymentInput[] = Array.isArray(body.otherPayments) ? body.otherPayments : [];

    const checkout = calculateMultiCurrencyCheckout(
      sale.balance_amount_xof,
      cashInput,
      otherPaymentsInput,
      currentRates
    );

    if (checkout.validationErrors.length > 0) {
      return NextResponse.json({ error: checkout.validationErrors[0], errors: checkout.validationErrors }, { status: 400 });
    }

    if (checkout.totalPaidFcfa <= 0) {
      return NextResponse.json({ error: "Aucun montant encaissé." }, { status: 400 });
    }

    // 4. Enregistrement des lignes de paiement
    const paymentsToInsert = [];

    // Enregistrement des espèces multidevise (si versé)
    if (checkout.totalCashInFcfa > 0) {
      const effectiveCash = Math.min(checkout.totalCashInFcfa, sale.balance_amount_xof);
      paymentsToInsert.push({
        tenant_id: context.tenantId,
        sale_id: saleId,
        site_id: sale.site_id,
        payment_method: "CASH",
        amount_xof: effectiveCash,
        reference: "COMPTOIR_ESPECES_MULTIDEVISE",
        received_by: context.user.id,
        cash_breakdown: {
          fcfa: checkout.cashFcfaInput,
          usd: checkout.cashUsdInput,
          eur: checkout.cashEurInput,
          usdRate: currentRates.usdToFcfa,
          eurRate: currentRates.eurToFcfa,
          totalCashEquivalentFcfa: checkout.totalCashInFcfa,
          changeGivenFcfa: checkout.changeDueFcfa,
        },
      });
    }

    // Enregistrement des autres règlements
    for (const other of otherPaymentsInput) {
      const amt = Math.max(0, Math.floor(other.amountFcfa || 0));
      if (amt <= 0) continue;

      paymentsToInsert.push({
        tenant_id: context.tenantId,
        sale_id: saleId,
        site_id: sale.site_id,
        payment_method: other.method,
        amount_xof: amt,
        reference: other.tpeReference || other.bankReference || other.mobileMoneyPhone || null,
        received_by: context.user.id,
        mobile_money_phone: other.mobileMoneyPhone || null,
        mobile_money_provider: other.mobileMoneyProvider || null,
        mobile_money_status: other.method === "MOBILE_MONEY" ? "SUCCESSFUL" : null,
        tpe_reference: other.tpeReference || null,
      });
    }

    const { data: insertedPayments, error: payErr } = await admin
      .from("couture_sale_payments")
      .insert(paymentsToInsert)
      .select();

    if (payErr) {
      return NextResponse.json({ error: "Erreur lors de l'enregistrement des paiements." }, { status: 500 });
    }

    // 5. Mise à jour de la vente
    const effectiveTotalPaidNow = Math.min(checkout.totalPaidFcfa, sale.balance_amount_xof);
    const newPaidAmount = sale.paid_amount_xof + effectiveTotalPaidNow;
    const newBalance = Math.max(0, sale.total_amount_xof - newPaidAmount);
    const newStatus = resolvePaymentStatus(sale.total_amount_xof, newPaidAmount);

    const { data: updatedSale, error: updateErr } = await admin
      .from("couture_sales")
      .update({
        paid_amount_xof: newPaidAmount,
        balance_amount_xof: newBalance,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", saleId)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (updateErr || !updatedSale) {
      return NextResponse.json({ error: "Erreur lors de la mise à jour des totaux de vente." }, { status: 500 });
    }

    // 6. Journal d'audit
    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.sale.checkout_multicurrency",
      entityType: "couture_sales",
      entityId: saleId,
      metadata: {
        saleNumber: sale.sale_number,
        totalDueFcfa: checkout.totalDueFcfa,
        totalPaidFcfa: checkout.totalPaidFcfa,
        changeDueFcfa: checkout.changeDueFcfa,
        newStatus,
      },
    });

    return NextResponse.json({
      success: true,
      sale: updatedSale,
      payments: insertedPayments,
      checkout,
      receipt: {
        saleNumber: sale.sale_number,
        totalAmountXof: sale.total_amount_xof,
        totalPaidNowXof: effectiveTotalPaidNow,
        balanceRemainingXof: newBalance,
        changeGivenXof: checkout.changeDueFcfa,
        isFullyPaid: newStatus === "PAID",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
