import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import {
  generateCoutureEntryNumber,
  validateBalancedEntry,
  type JournalEntryLineDraft,
} from "@/lib/couture-accounting";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const journalCode = searchParams.get("journalCode");
    const fiscalYear = searchParams.get("fiscalYear");
    const periodMonth = searchParams.get("periodMonth");
    const siteId = searchParams.get("siteId");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "accounting.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_journal_entries")
      .select(`
        *,
        site:couture_sites!site_id (id, name, site_type, city),
        lines:couture_journal_entry_lines (*)
      `)
      .eq("tenant_id", context.tenantId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (journalCode) query = query.eq("journal_code", journalCode);
    if (fiscalYear) query = query.eq("fiscal_year", Number(fiscalYear));
    if (periodMonth) query = query.eq("period_month", Number(periodMonth));
    if (siteId) query = query.eq("site_id", siteId);

    const { data: entries, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les écritures comptables." }, { status: 500 });
    }

    return NextResponse.json({ entries: entries ?? [] });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
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

    assertCouturePermission(context, "accounting.view");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const journalCode = String(body.journalCode || "OD").toUpperCase();
    const entryDate = typeof body.entryDate === "string" ? body.entryDate : new Date().toISOString().slice(0, 10);
    const dateObj = new Date(entryDate);
    const fiscalYear = Number(body.fiscalYear) || dateObj.getFullYear();
    const periodMonth = Number(body.periodMonth) || dateObj.getMonth() + 1;
    const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 120) : "PIECE";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 300) : "Écriture comptable";
    const sourceModule = ["SALES", "PURCHASES", "PETTY_CASH", "PAYROLL", "TREASURY", "MANUAL_OD"].includes(body.sourceModule)
      ? body.sourceModule
      : "MANUAL_OD";
    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : null;
    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "FCFA";
    const linesInput = Array.isArray(body.lines) ? body.lines : [];

    if (linesInput.length < 2) {
      return NextResponse.json({ error: "Une écriture comptable requiert au moins 2 lignes (partie double)." }, { status: 400 });
    }

    // 1. Validation de la partie double Débit == Crédit
    const linesDraft: JournalEntryLineDraft[] = linesInput.map((l: any) => ({
      accountNumber: String(l.accountNumber || "").trim(),
      label: typeof l.label === "string" ? l.label.trim().slice(0, 240) : description,
      debit: Math.max(0, Math.round(Number(l.debit) || 0)),
      credit: Math.max(0, Math.round(Number(l.credit) || 0)),
      currency,
      amountInRefCurrency: Math.max(0, Math.round(Number(l.amountInRefCurrency ?? (l.debit || l.credit)) || 0)),
    }));

    const balanceCheck = validateBalancedEntry(linesDraft);
    if (!balanceCheck.isBalanced) {
      return NextResponse.json({
        error: `Écriture déséquilibrée : Total Débit (${balanceCheck.totalDebit}) ≠ Total Crédit (${balanceCheck.totalCredit}) [Écart : ${balanceCheck.difference}].`,
      }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 2. Génération du numéro séquentiel ECR-YYYY-XXXXXX
    const { count } = await admin
      .from("couture_journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId)
      .like("entry_number", `ECR-${fiscalYear}-%`);

    const sequence = (count ?? 0) + 1;
    const entryNumber = generateCoutureEntryNumber(sequence, fiscalYear);

    // 3. Insertion de la pièce comptable
    const { data: entry, error: entryErr } = await admin
      .from("couture_journal_entries")
      .insert({
        tenant_id: context.tenantId,
        site_id: siteId,
        entry_number: entryNumber,
        journal_code: journalCode,
        entry_date: entryDate,
        fiscal_year: fiscalYear,
        period_month: periodMonth,
        reference,
        description,
        source_module: sourceModule,
        currency,
        total_debit: balanceCheck.totalDebit,
        total_credit: balanceCheck.totalCredit,
        is_balanced: true,
        is_posted: true,
        created_by: context.user.id,
      })
      .select()
      .single();

    if (entryErr || !entry) {
      return NextResponse.json({ error: "Impossible d'enregistrer la pièce comptable." }, { status: 500 });
    }

    // 4. Insertion des lignes d'écriture
    const linesToInsert = linesDraft.map((l) => ({
      tenant_id: context.tenantId,
      entry_id: entry.id,
      account_number: l.accountNumber,
      label: l.label,
      debit_amount: l.debit,
      credit_amount: l.credit,
      currency,
      amount_in_ref_currency: l.amountInRefCurrency || (l.debit > 0 ? l.debit : l.credit),
    }));

    const { error: linesErr } = await admin
      .from("couture_journal_entry_lines")
      .insert(linesToInsert);

    if (linesErr) {
      await admin.from("couture_journal_entries").delete().eq("id", entry.id);
      return NextResponse.json({ error: "Impossible d'enregistrer les lignes d'écriture." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.accounting.entry_create",
      entityType: "couture_journal_entries",
      entityId: entry.id,
      metadata: {
        entryNumber,
        journalCode,
        totalDebit: balanceCheck.totalDebit,
        totalCredit: balanceCheck.totalCredit,
        linesCount: linesToInsert.length,
      },
    });

    return NextResponse.json({
      entry: {
        ...entry,
        lines: linesToInsert,
      },
    }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
