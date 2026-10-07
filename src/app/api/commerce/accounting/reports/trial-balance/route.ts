import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fiscalYear = searchParams.get("year");

    const admin = createSupabaseAdminClient();

    const query = admin
      .from("commerce_journal_entry_lines")
      .select(`
        account_number, account_name, debit_amount_xof, credit_amount_xof,
        entry:commerce_journal_entries!commerce_journal_entry_lines_entry_id_fkey(fiscal_year, is_posted)
      `)
      .eq("tenant_id", context.tenantId);

    const { data: lines, error } = await query;
    if (error) {
      console.error("[reports/trial-balance.GET] error", error);
      return NextResponse.json({ error: "Impossible de générer la balance générale." }, { status: 500 });
    }

    // Agréger par compte
    const accountsMap = new Map<string, {
      account_number: string;
      account_name: string;
      total_debit: number;
      total_credit: number;
    }>();

    for (const line of lines || []) {
      // Filtrer par exercice si spécifié
      // @ts-expect-error Supabase nested relation
      if (fiscalYear && line.entry?.fiscal_year !== parseInt(fiscalYear, 10)) {
        continue;
      }

      const accNum = line.account_number;
      const existing = accountsMap.get(accNum) || {
        account_number: accNum,
        account_name: line.account_name,
        total_debit: 0,
        total_credit: 0,
      };

      existing.total_debit += Number(line.debit_amount_xof) || 0;
      existing.total_credit += Number(line.credit_amount_xof) || 0;
      accountsMap.set(accNum, existing);
    }

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;
    let grandTotalDebitBalance = 0;
    let grandTotalCreditBalance = 0;

    const balanceRows = Array.from(accountsMap.values())
      .sort((a, b) => a.account_number.localeCompare(b.account_number))
      .map((acc) => {
        const net = acc.total_debit - acc.total_credit;
        const debitBalance = net > 0 ? net : 0;
        const creditBalance = net < 0 ? Math.abs(net) : 0;

        grandTotalDebit += acc.total_debit;
        grandTotalCredit += acc.total_credit;
        grandTotalDebitBalance += debitBalance;
        grandTotalCreditBalance += creditBalance;

        return {
          account_number: acc.account_number,
          account_name: acc.account_name,
          account_class: parseInt(acc.account_number[0], 10),
          total_debit_xof: acc.total_debit,
          total_credit_xof: acc.total_credit,
          debit_balance_xof: debitBalance,
          credit_balance_xof: creditBalance,
        };
      });

    return NextResponse.json({
      rows: balanceRows,
      totals: {
        totalDebit: grandTotalDebit,
        totalCredit: grandTotalCredit,
        totalDebitBalance: grandTotalDebitBalance,
        totalCreditBalance: grandTotalCreditBalance,
        isBalanced: grandTotalDebit === grandTotalCredit && grandTotalDebitBalance === grandTotalCreditBalance,
      },
    });
  } catch (err) {
    console.error("[reports/trial-balance.GET] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
