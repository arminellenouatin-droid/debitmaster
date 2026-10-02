import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { defaultExchangeRates, type CoutureExchangeRates } from "@/lib/couture-multi-currency";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sales.multi_currency");

    const admin = createSupabaseAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: ratesRows } = await admin
      .from("couture_exchange_rates")
      .select("currency, rate_to_fcfa, effective_date, source")
      .eq("tenant_id", context.tenantId)
      .lte("effective_date", today)
      .order("effective_date", { ascending: false });

    let eurToFcfa = defaultExchangeRates.eurToFcfa;
    let usdToFcfa = defaultExchangeRates.usdToFcfa;

    if (ratesRows && ratesRows.length > 0) {
      const latestEur = ratesRows.find((r) => r.currency === "EUR");
      if (latestEur && Number(latestEur.rate_to_fcfa) > 0) {
        eurToFcfa = Number(latestEur.rate_to_fcfa);
      }
      const latestUsd = ratesRows.find((r) => r.currency === "USD");
      if (latestUsd && Number(latestUsd.rate_to_fcfa) > 0) {
        usdToFcfa = Number(latestUsd.rate_to_fcfa);
      }
    }

    const rates: CoutureExchangeRates = {
      eurToFcfa,
      usdToFcfa,
      effectiveDate: today,
    };

    return NextResponse.json({ rates });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

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

    const eurToFcfa = Number(body.eurToFcfa);
    const usdToFcfa = Number(body.usdToFcfa);
    const today = new Date().toISOString().slice(0, 10);

    if (!Number.isFinite(eurToFcfa) || eurToFcfa <= 0 || !Number.isFinite(usdToFcfa) || usdToFcfa <= 0) {
      return NextResponse.json({ error: "Taux de change invalides." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Upsert EUR
    await admin.from("couture_exchange_rates").upsert(
      {
        tenant_id: context.tenantId,
        currency: "EUR",
        rate_to_fcfa: eurToFcfa,
        effective_date: today,
        source: "MANUAL",
      },
      { onConflict: "tenant_id,currency,effective_date" }
    );

    // Upsert USD
    await admin.from("couture_exchange_rates").upsert(
      {
        tenant_id: context.tenantId,
        currency: "USD",
        rate_to_fcfa: usdToFcfa,
        effective_date: today,
        source: "MANUAL",
      },
      { onConflict: "tenant_id,currency,effective_date" }
    );

    return NextResponse.json({
      success: true,
      rates: {
        eurToFcfa,
        usdToFcfa,
        effectiveDate: today,
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
