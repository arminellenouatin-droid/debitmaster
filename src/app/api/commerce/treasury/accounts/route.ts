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

    // 1. Récupérer les comptes de trésorerie
    const { data: accounts, error: accErr } = await admin
      .from("commerce_treasury_accounts")
      .select("id, name, account_type, account_number, bank_name, initial_balance_xof, current_balance_xof, status, store_id, created_at")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .order("account_type", { ascending: true })
      .order("name", { ascending: true });

    if (accErr) {
      console.error("[treasury/accounts.GET] accounts error", accErr);
      return NextResponse.json({ error: "Impossible de récupérer les comptes de trésorerie." }, { status: 500 });
    }

    // 2. Récupérer les 30 dernières transactions
    const { data: transactions, error: txErr } = await admin
      .from("commerce_treasury_transactions")
      .select("id, account_id, transaction_type, amount_xof, balance_after_xof, reference, category, description, created_at")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (txErr) {
      console.error("[treasury/accounts.GET] tx error", txErr);
    }

    // Calculer les totaux de liquidités
    let cashTotal = 0;
    let bankTotal = 0;
    let momoTotal = 0;

    for (const acc of accounts || []) {
      const bal = Number(acc.current_balance_xof) || 0;
      if (acc.account_type === "CASH") cashTotal += bal;
      else if (acc.account_type === "BANK") bankTotal += bal;
      else if (acc.account_type === "MOBILE_MONEY") momoTotal += bal;
    }

    const netLiquidity = cashTotal + bankTotal + momoTotal;

    return NextResponse.json({
      accounts: accounts || [],
      transactions: transactions || [],
      summary: {
        cashTotal,
        bankTotal,
        momoTotal,
        netLiquidity,
      },
    });
  } catch (err) {
    console.error("[treasury/accounts.GET] unexpected error", err);
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
    const { name, accountType, accountNumber, bankName, initialBalanceXof = 0, storeId } = body;

    if (!name || !accountType) {
      return NextResponse.json({ error: "Le nom et le type de compte sont obligatoires." }, { status: 400 });
    }

    if (!["CASH", "BANK", "MOBILE_MONEY"].includes(accountType)) {
      return NextResponse.json({ error: "Type de compte invalide (CASH, BANK, MOBILE_MONEY acceptés)." }, { status: 400 });
    }

    const initBal = Math.max(0, Math.round(Number(initialBalanceXof) || 0));
    const admin = createSupabaseAdminClient();

    const { data: createdAccount, error: accErr } = await admin
      .from("commerce_treasury_accounts")
      .insert({
        tenant_id: context.tenantId,
        name: String(name).trim(),
        account_type: accountType,
        account_number: accountNumber ? String(accountNumber).trim() : null,
        bank_name: bankName ? String(bankName).trim() : null,
        initial_balance_xof: initBal,
        current_balance_xof: initBal,
        store_id: storeId || null,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (accErr || !createdAccount) {
      console.error("[treasury/accounts.POST] insert error", accErr);
      return NextResponse.json({ error: "Impossible de créer le compte de trésorerie." }, { status: 500 });
    }

    // Si solde initial > 0, consigner la transaction initiale
    if (initBal > 0) {
      await admin.from("commerce_treasury_transactions").insert({
        tenant_id: context.tenantId,
        account_id: createdAccount.id,
        transaction_type: "INCOME",
        amount_xof: initBal,
        balance_after_xof: initBal,
        reference: "SOLDE_INITIAL",
        category: "OUVERTURE",
        description: `Solde d'ouverture du compte ${createdAccount.name}`,
        performed_by_user_id: context.user.id,
      });
    }

    return NextResponse.json({
      success: true,
      account: createdAccount,
      message: `Compte de trésorerie « ${createdAccount.name} » créé avec succès.`,
    });
  } catch (err) {
    console.error("[treasury/accounts.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
