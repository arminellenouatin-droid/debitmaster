import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Vérifier si le plan de compte est initialisé pour ce tenant
    const { count, error: countErr } = await admin
      .from("commerce_chart_of_accounts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId);

    if (countErr) {
      console.error("[accounting/chart.GET] count error", countErr);
    }

    if (!count || count === 0) {
      // Auto-initialisation du plan SYSCOHADA révisé
      try {
        await admin.rpc("initialize_tenant_chart_of_accounts", { p_tenant_id: context.tenantId });
      } catch (initErr) {
        console.error("[accounting/chart.GET] init rpc error", initErr);
      }
    }

    // 2. Récupérer les comptes
    const { data: accounts, error: accErr } = await admin
      .from("commerce_chart_of_accounts")
      .select("id, account_number, account_name, account_class, account_type, is_system, is_active")
      .eq("tenant_id", context.tenantId)
      .eq("is_active", true)
      .order("account_number", { ascending: true });

    if (accErr) {
      console.error("[accounting/chart.GET] accounts error", accErr);
      return NextResponse.json({ error: "Impossible de récupérer le plan de comptes." }, { status: 500 });
    }

    // 3. Récupérer les journaux
    const { data: journals } = await admin
      .from("commerce_accounting_journals")
      .select("id, code, name")
      .eq("tenant_id", context.tenantId)
      .order("code", { ascending: true });

    // 4. Récupérer les exercices fiscaux
    const { data: fiscalYears } = await admin
      .from("commerce_accounting_fiscal_years")
      .select("id, fiscal_year, start_date, end_date, status")
      .eq("tenant_id", context.tenantId)
      .order("fiscal_year", { ascending: false });

    return NextResponse.json({
      accounts: accounts || [],
      journals: journals || [],
      fiscalYears: fiscalYears || [],
    });
  } catch (err) {
    console.error("[accounting/chart.GET] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await request.json();
    const { accountNumber, accountName, accountType } = body;

    if (!accountNumber || !accountName || !accountType) {
      return NextResponse.json({ error: "Numéro de compte, intitulé et type sont obligatoires." }, { status: 400 });
    }

    const cleanNum = String(accountNumber).trim();
    const accountClass = parseInt(cleanNum[0], 10);

    if (isNaN(accountClass) || accountClass < 1 || accountClass > 9) {
      return NextResponse.json({ error: "Le numéro de compte doit commencer par un chiffre entre 1 et 9." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: createdAccount, error: accErr } = await admin
      .from("commerce_chart_of_accounts")
      .insert({
        tenant_id: context.tenantId,
        account_number: cleanNum,
        account_name: String(accountName).trim(),
        account_class: accountClass,
        account_type: accountType,
        is_system: false,
        is_active: true,
      })
      .select()
      .single();

    if (accErr || !createdAccount) {
      console.error("[accounting/chart.POST] insert error", accErr);
      return NextResponse.json({ error: "Ce numéro de compte existe déjà ou est invalide." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      account: createdAccount,
      message: `Compte ${cleanNum} (${accountName}) ajouté au plan comptable.`,
    });
  } catch (err) {
    console.error("[accounting/chart.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
