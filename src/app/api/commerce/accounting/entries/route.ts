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

    const { searchParams } = new URL(request.url);
    const journalCode = searchParams.get("journal");
    const fiscalYear = searchParams.get("year");
    const search = searchParams.get("q");

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("commerce_journal_entries")
      .select(`
        id, entry_number, journal_code, entry_date, fiscal_year, period_month,
        reference, description, source_module, total_debit_xof, total_credit_xof,
        is_balanced, is_posted, created_at,
        lines:commerce_journal_entry_lines (
          id, account_number, account_name, debit_amount_xof, credit_amount_xof, partner_name, line_description
        )
      `)
      .eq("tenant_id", context.tenantId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (journalCode) {
      query = query.eq("journal_code", journalCode);
    }
    if (fiscalYear) {
      query = query.eq("fiscal_year", parseInt(fiscalYear, 10));
    }
    if (search) {
      query = query.or(`entry_number.ilike.%${search}%,reference.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: entries, error } = await query;
    if (error) {
      console.error("[accounting/entries.GET] error", error);
      return NextResponse.json({ error: "Impossible de récupérer les écritures comptables." }, { status: 500 });
    }

    return NextResponse.json({ entries: entries || [] });
  } catch (err) {
    console.error("[accounting/entries.GET] unexpected error", err);
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
    const {
      journalCode,
      entryDate,
      reference,
      description,
      sourceModule = "MANUAL_OD",
      lines,
    } = body;

    if (!journalCode || !description || !Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json({
        error: "Journal, description et au moins 2 lignes d'écriture sont obligatoires.",
      }, { status: 400 });
    }

    // 1. Contrôle strict de la Partie Double OHADA : Débit = Crédit
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      const d = Math.max(0, Math.round(Number(line.debitAmountXof) || 0));
      const c = Math.max(0, Math.round(Number(line.creditAmountXof) || 0));
      totalDebit += d;
      totalCredit += c;
    }

    if (totalDebit === 0 && totalCredit === 0) {
      return NextResponse.json({ error: "Le montant total de la pièce ne peut pas être nul." }, { status: 400 });
    }

    if (totalDebit !== totalCredit) {
      return NextResponse.json({
        error: `Pièce comptable déséquilibrée : Total Débit (${totalDebit.toLocaleString("fr-FR")} FCFA) ≠ Total Crédit (${totalCredit.toLocaleString("fr-FR")} FCFA). Écart : ${Math.abs(totalDebit - totalCredit).toLocaleString("fr-FR")} FCFA.`,
      }, { status: 400 });
    }

    const dateStr = entryDate || new Date().toISOString().split("T")[0];
    const parsedDate = new Date(dateStr);
    const fiscalYear = parsedDate.getFullYear();
    const periodMonth = parsedDate.getMonth() + 1;

    const admin = createSupabaseAdminClient();

    // 2. Génération séquentielle ECR-YYYY-XXXXXX
    let entryNumber: string;
    try {
      const { data: numData, error: numErr } = await admin.rpc("next_document_number", {
        p_tenant_id: context.tenantId,
        p_doc_type: "JOURNAL_ENTRY",
      });
      if (numErr || !numData) {
        entryNumber = `ECR-${fiscalYear}-${Date.now().toString().slice(-6)}`;
      } else {
        entryNumber = numData;
      }
    } catch {
      entryNumber = `ECR-${fiscalYear}-${Date.now().toString().slice(-6)}`;
    }

    // 3. Insérer la pièce comptable
    const { data: createdEntry, error: entryErr } = await admin
      .from("commerce_journal_entries")
      .insert({
        tenant_id: context.tenantId,
        entry_number: entryNumber,
        journal_code: journalCode,
        entry_date: dateStr,
        fiscal_year: fiscalYear,
        period_month: periodMonth,
        reference: reference ? String(reference).trim() : entryNumber,
        description: String(description).trim(),
        source_module: sourceModule,
        total_debit_xof: totalDebit,
        total_credit_xof: totalCredit,
        is_balanced: true,
        is_posted: true,
        created_by_user_id: context.user.id,
      })
      .select()
      .single();

    if (entryErr || !createdEntry) {
      console.error("[accounting/entries.POST] insert error", entryErr);
      return NextResponse.json({ error: "Échec de création de la pièce comptable." }, { status: 500 });
    }

    // 4. Insérer les lignes d'écriture
    const linesToInsert = lines.map((l) => ({
      tenant_id: context.tenantId,
      entry_id: createdEntry.id,
      account_number: String(l.accountNumber).trim(),
      account_name: String(l.accountName).trim(),
      debit_amount_xof: Math.max(0, Math.round(Number(l.debitAmountXof) || 0)),
      credit_amount_xof: Math.max(0, Math.round(Number(l.creditAmountXof) || 0)),
      partner_name: l.partnerName ? String(l.partnerName).trim() : null,
      line_description: l.lineDescription ? String(l.lineDescription).trim() : null,
    }));

    const { error: linesErr } = await admin.from("commerce_journal_entry_lines").insert(linesToInsert);
    if (linesErr) {
      console.error("[accounting/entries.POST] lines insert error", linesErr);
      return NextResponse.json({ error: "Échec d'enregistrement des lignes d'écriture." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      entry: createdEntry,
      message: `Pièce comptable ${entryNumber} enregistrée avec succès (Équilibrée : ${totalDebit.toLocaleString("fr-FR")} FCFA).`,
    });
  } catch (err) {
    console.error("[accounting/entries.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
