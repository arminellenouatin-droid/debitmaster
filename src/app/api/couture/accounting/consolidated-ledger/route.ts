import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const fiscalYear = searchParams.get("fiscalYear") || String(new Date().getFullYear());
    const siteId = searchParams.get("siteId");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "accounting.view");

    const admin = createSupabaseAdminClient();

    // 1. Paramètres de consolidation de l'établissement
    const { data: settings } = await admin
      .from("couture_consolidated_settings")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

    const referenceCurrency = settings?.reference_currency || "FCFA";

    // 2. Sites de l'établissement
    const { data: sites } = await admin
      .from("couture_sites")
      .select("id, name, site_type, city, currency")
      .eq("tenant_id", context.tenantId);

    // 3. Récupérer toutes les écritures de l'exercice
    let entriesQuery = admin
      .from("couture_journal_entries")
      .select("id, site_id, currency, fiscal_year, period_month")
      .eq("tenant_id", context.tenantId)
      .eq("fiscal_year", Number(fiscalYear));

    if (siteId) {
      entriesQuery = entriesQuery.eq("site_id", siteId);
    }

    const { data: entries, error: entriesErr } = await entriesQuery;
    if (entriesErr) {
      return NextResponse.json({ error: "Impossible de charger les écritures comptables." }, { status: 500 });
    }

    const entryIds = (entries ?? []).map((e) => e.id);

    // Si aucune écriture, renvoyer un état vierge
    if (entryIds.length === 0) {
      return NextResponse.json({
        fiscalYear: Number(fiscalYear),
        referenceCurrency,
        trialBalance: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: true,
        sitesCount: (sites ?? []).length,
      });
    }

    // 4. Récupérer les lignes d'écritures
    const { data: lines, error: linesErr } = await admin
      .from("couture_journal_entry_lines")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .in("entry_id", entryIds);

    if (linesErr) {
      return NextResponse.json({ error: "Impossible de charger les lignes de grand livre." }, { status: 500 });
    }

    // 5. Récupérer le plan de comptes pour les libellés
    const { data: chartAccounts } = await admin
      .from("couture_chart_of_accounts")
      .select("account_number, account_name, account_class, account_type")
      .eq("tenant_id", context.tenantId);

    const accountNameMap = new Map<string, string>();
    for (const ca of chartAccounts ?? []) {
      accountNameMap.set(ca.account_number, ca.account_name);
    }

    // 6. Agréger par compte
    const accountAggregation = new Map<string, {
      accountNumber: string;
      accountName: string;
      totalDebit: number;
      totalCredit: number;
      balanceDebit: number;
      balanceCredit: number;
    }>();

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    for (const line of lines ?? []) {
      const debit = Number(line.debit_amount) || 0;
      const credit = Number(line.credit_amount) || 0;
      grandTotalDebit += debit;
      grandTotalCredit += credit;

      const accNum = line.account_number;
      const current = accountAggregation.get(accNum) || {
        accountNumber: accNum,
        accountName: accountNameMap.get(accNum) || line.label || `Compte ${accNum}`,
        totalDebit: 0,
        totalCredit: 0,
        balanceDebit: 0,
        balanceCredit: 0,
      };

      current.totalDebit += debit;
      current.totalCredit += credit;
      accountAggregation.set(accNum, current);
    }

    // Calcul des soldes nets débiteurs/créditeurs par compte
    const trialBalance = Array.from(accountAggregation.values())
      .map((acc) => {
        const net = acc.totalDebit - acc.totalCredit;
        return {
          ...acc,
          balanceDebit: net > 0 ? net : 0,
          balanceCredit: net < 0 ? Math.abs(net) : 0,
        };
      })
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    return NextResponse.json({
      fiscalYear: Number(fiscalYear),
      referenceCurrency,
      trialBalance,
      totalDebit: grandTotalDebit,
      totalCredit: grandTotalCredit,
      isBalanced: grandTotalDebit === grandTotalCredit,
      sites: sites ?? [],
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
