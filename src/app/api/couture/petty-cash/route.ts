import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import {
  validatePettyCashExpense,
  generatePettyCashExpenseNumber,
  PETTY_CASH_DEFAULT_FUND_XOF,
} from "@/lib/couture-supplies";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const siteId = searchParams.get("siteId");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "petty_cash.view");

    if (!siteId) {
      return NextResponse.json({ error: "Atelier (siteId) requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Récupérer ou initialiser le fonds de petite caisse
    let { data: fund } = await admin
      .from("couture_petty_cash_funds")
      .select("*")
      .eq("site_id", siteId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

    if (!fund) {
      const { data: createdFund } = await admin
        .from("couture_petty_cash_funds")
        .insert({
          tenant_id: context.tenantId,
          site_id: siteId,
          fund_limit_xof: PETTY_CASH_DEFAULT_FUND_XOF,
          current_balance_xof: PETTY_CASH_DEFAULT_FUND_XOF,
        })
        .select()
        .single();
      fund = createdFund;
    }

    // 2. Récupérer les dépenses récentes
    const { data: expenses } = await admin
      .from("couture_petty_cash_expenses")
      .select("*")
      .eq("site_id", siteId)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      fund: fund ?? { fund_limit_xof: 20000, current_balance_xof: 20000 },
      expenses: expenses ?? [],
    });
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

    assertCouturePermission(context, "petty_cash.spend");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const amountXof = Math.floor(Number(body.amountXof) || 0);
    const purpose = typeof body.purpose === "string" ? body.purpose.trim().slice(0, 240) : "";
    const receiptUrl = typeof body.receiptUrl === "string" ? body.receiptUrl.trim() : null;

    if (!siteId || purpose.length < 2) {
      return NextResponse.json({ error: "Atelier et motif de la dépense requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Charger le fonds
    let { data: fund } = await admin
      .from("couture_petty_cash_funds")
      .select("id, current_balance_xof, fund_limit_xof")
      .eq("site_id", siteId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

    if (!fund) {
      const { data: createdFund } = await admin
        .from("couture_petty_cash_funds")
        .insert({
          tenant_id: context.tenantId,
          site_id: siteId,
          fund_limit_xof: PETTY_CASH_DEFAULT_FUND_XOF,
          current_balance_xof: PETTY_CASH_DEFAULT_FUND_XOF,
        })
        .select()
        .single();
      fund = createdFund;
    }

    const currentBalance = Number(fund?.current_balance_xof) || 0;

    // 2. Valider le plafond (2 000 FCFA max) et solde
    const validation = validatePettyCashExpense(currentBalance, amountXof);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 3. Numéro de dépense PC-YYYY-XXXXXX
    const currentYear = new Date().getFullYear();
    const { count } = await admin
      .from("couture_petty_cash_expenses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId)
      .like("expense_number", `PC-${currentYear}-%`);

    const sequence = (count ?? 0) + 1;
    const expenseNumber = generatePettyCashExpenseNumber(sequence, currentYear);

    // 4. Insérer la dépense
    const { data: expense, error: expErr } = await admin
      .from("couture_petty_cash_expenses")
      .insert({
        tenant_id: context.tenantId,
        site_id: siteId,
        expense_number: expenseNumber,
        amount_xof: amountXof,
        purpose,
        receipt_url: receiptUrl,
        visa_status: "PENDING",
        created_by: context.user.id,
      })
      .select()
      .single();

    if (expErr || !expense) {
      return NextResponse.json({ error: "Impossible d'enregistrer la dépense de petite caisse." }, { status: 500 });
    }

    // 5. Déduire le solde du fonds
    const newBalance = Math.max(0, currentBalance - amountXof);
    await admin
      .from("couture_petty_cash_funds")
      .update({
        current_balance_xof: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("site_id", siteId)
      .eq("tenant_id", context.tenantId);

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.petty_cash.spend",
      entityType: "couture_petty_cash_expenses",
      entityId: expense.id,
      metadata: {
        expenseNumber,
        amountXof,
        purpose,
        newBalance,
      },
    });

    return NextResponse.json(
      {
        expense,
        newBalance,
        message: `Dépense de ${amountXof} FCFA enregistrée (solde restant : ${newBalance} FCFA). En attente du visa comptable.`,
      },
      { status: 201 }
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
