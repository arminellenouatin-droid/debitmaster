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
    const accountFilter = searchParams.get("account");

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("commerce_journal_entry_lines")
      .select(`
        id, account_number, account_name, debit_amount_xof, credit_amount_xof, partner_name, line_description, created_at,
        entry:commerce_journal_entries!commerce_journal_entry_lines_entry_id_fkey(
          entry_number, journal_code, entry_date, fiscal_year, reference, description
        )
      `)
      .eq("tenant_id", context.tenantId)
      .order("account_number", { ascending: true });

    if (accountFilter) {
      query = query.eq("account_number", accountFilter);
    }

    const { data: lines, error } = await query;
    if (error) {
      console.error("[reports/general-ledger.GET] error", error);
      return NextResponse.json({ error: "Impossible de générer le grand livre." }, { status: 500 });
    }

    type Movement = {
      id: string;
      date: string;
      entry_number: string;
      journal_code: string;
      reference: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    };

    type AccountLedger = {
      account_number: string;
      account_name: string;
      total_debit: number;
      total_credit: number;
      movements: Movement[];
    };

    // Regrouper par compte
    const ledgerMap = new Map<string, AccountLedger>();

    for (const line of lines || []) {
      // @ts-expect-error Supabase nested relation
      if (fiscalYear && line.entry?.fiscal_year !== parseInt(fiscalYear, 10)) {
        continue;
      }

      const accNum = line.account_number;
      const existing: AccountLedger = ledgerMap.get(accNum) || {
        account_number: accNum,
        account_name: line.account_name,
        total_debit: 0,
        total_credit: 0,
        movements: [],
      };

      const debit = Number(line.debit_amount_xof) || 0;
      const credit = Number(line.credit_amount_xof) || 0;
      existing.total_debit += debit;
      existing.total_credit += credit;

      // Solde progressif (Débit - Crédit)
      const currentNetBalance = existing.total_debit - existing.total_credit;

      existing.movements.push({
        id: line.id,
        // @ts-expect-error Supabase nested relation
        date: line.entry?.entry_date || line.created_at,
        // @ts-expect-error Supabase nested relation
        entry_number: line.entry?.entry_number || "-",
        // @ts-expect-error Supabase nested relation
        journal_code: line.entry?.journal_code || "-",
        // @ts-expect-error Supabase nested relation
        reference: line.entry?.reference || "-",
        description: line.line_description || line.partner_name || "Écriture comptable",
        debit,
        credit,
        balance: currentNetBalance,
      });

      ledgerMap.set(accNum, existing);
    }

    const accounts = Array.from(ledgerMap.values()).sort((a, b) => a.account_number.localeCompare(b.account_number));

    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("[reports/general-ledger.GET] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
