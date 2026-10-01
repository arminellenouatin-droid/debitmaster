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
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("commerce_expenses")
      .select(`
        id, expense_number, title, category, amount_xof, tax_amount_xof, total_amount_xof,
        paid_from_account_id, beneficiary, receipt_reference, status, approval_threshold_exceeded,
        notes, expense_date, created_at, approved_at,
        account:commerce_treasury_accounts!commerce_expenses_paid_from_account_id_fkey(name, account_type)
      `)
      .eq("tenant_id", context.tenantId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (category) {
      query = query.eq("category", category);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data: expenses, error: expErr } = await query;
    if (expErr) {
      console.error("[expenses.GET] error", expErr);
      return NextResponse.json({ error: "Impossible de récupérer les dépenses." }, { status: 500 });
    }

    // Récupérer les comptes pour le formulaire de saisie
    const { data: accounts } = await admin
      .from("commerce_treasury_accounts")
      .select("id, name, account_type, current_balance_xof")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true });

    // Calcul des totaux par catégorie et total global
    let totalExpensesXof = 0;
    let pendingApprovalXof = 0;
    const categoryTotals: Record<string, number> = {};

    for (const exp of expenses || []) {
      const amt = Number(exp.total_amount_xof) || 0;
      if (exp.status === "PAID" || exp.status === "APPROVED") {
        totalExpensesXof += amt;
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amt;
      } else if (exp.status === "PENDING_APPROVAL") {
        pendingApprovalXof += amt;
      }
    }

    return NextResponse.json({
      expenses: expenses || [],
      accounts: accounts || [],
      summary: {
        totalExpensesXof,
        pendingApprovalXof,
        categoryTotals,
      },
    });
  } catch (err) {
    console.error("[expenses.GET] unexpected error", err);
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
      title,
      category,
      amountXof,
      taxAmountXof = 0,
      paidFromAccountId,
      beneficiary,
      receiptReference,
      expenseDate,
      notes,
    } = body;

    if (!title || !category || !amountXof || !paidFromAccountId) {
      return NextResponse.json({
        error: "Le titre, la catégorie, le montant et le compte de trésorerie payeur sont obligatoires.",
      }, { status: 400 });
    }

    const amount = Math.round(Number(amountXof));
    const tax = Math.max(0, Math.round(Number(taxAmountXof) || 0));
    const totalAmount = amount + tax;

    if (totalAmount <= 0) {
      return NextResponse.json({ error: "Le montant total de la dépense doit être strictement positif." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Vérifier le compte de trésorerie
    const { data: account, error: accErr } = await admin
      .from("commerce_treasury_accounts")
      .select("id, name, current_balance_xof")
      .eq("id", paidFromAccountId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "Compte de trésorerie payeur introuvable." }, { status: 404 });
    }

    // 2. Règle de seuil d'approbation (ex. 100 000 FCFA)
    const APPROVAL_THRESHOLD = 100000;
    const isManagerOrAdmin =
      ["ADMINISTRATEUR", "GERANT", "SUPERVISEUR"].includes(context.role || "") ||
      context.permissions.has("expenses.approve");

    const requiresApproval = totalAmount >= APPROVAL_THRESHOLD && !isManagerOrAdmin;

    // Si pas d'approbation requise, vérifier le solde
    if (!requiresApproval && Number(account.current_balance_xof) < totalAmount) {
      return NextResponse.json({
        error: `Solde insuffisant sur le compte ${account.name} (${Number(account.current_balance_xof).toLocaleString("fr-FR")} FCFA disponibles, ${totalAmount.toLocaleString("fr-FR")} FCFA requis).`,
      }, { status: 400 });
    }

    // 3. Numérotation séquentielle DEP
    let expenseNumber: string;
    try {
      const { data: numData, error: numErr } = await admin.rpc("next_document_number", {
        p_tenant_id: context.tenantId,
        p_doc_type: "EXPENSE",
      });
      if (numErr || !numData) {
        expenseNumber = `DEP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      } else {
        expenseNumber = numData;
      }
    } catch {
      expenseNumber = `DEP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }

    const now = new Date().toISOString();
    const initialStatus = requiresApproval ? "PENDING_APPROVAL" : "PAID";

    // 4. Insérer la dépense
    const { data: createdExpense, error: expErr } = await admin
      .from("commerce_expenses")
      .insert({
        tenant_id: context.tenantId,
        expense_number: expenseNumber,
        title: String(title).trim(),
        category,
        amount_xof: amount,
        tax_amount_xof: tax,
        total_amount_xof: totalAmount,
        paid_from_account_id: paidFromAccountId,
        beneficiary: beneficiary ? String(beneficiary).trim() : null,
        receipt_reference: receiptReference ? String(receiptReference).trim() : null,
        status: initialStatus,
        approval_threshold_exceeded: totalAmount >= APPROVAL_THRESHOLD,
        notes: notes ? String(notes).trim() : null,
        expense_date: expenseDate || new Date().toISOString().split("T")[0],
        created_by_user_id: context.user.id,
        approved_by_user_id: requiresApproval ? null : context.user.id,
        approved_at: requiresApproval ? null : now,
      })
      .select()
      .single();

    if (expErr || !createdExpense) {
      console.error("[expenses.POST] insert error", expErr);
      return NextResponse.json({ error: "Échec d'enregistrement de la dépense." }, { status: 500 });
    }

    // 5. Si payée immédiatement, décrémenter le compte et consigner la transaction
    if (initialStatus === "PAID") {
      const newBal = Number(account.current_balance_xof) - totalAmount;

      await admin
        .from("commerce_treasury_accounts")
        .update({ current_balance_xof: newBal, updated_at: now })
        .eq("id", paidFromAccountId);

      await admin.from("commerce_treasury_transactions").insert({
        tenant_id: context.tenantId,
        account_id: paidFromAccountId,
        transaction_type: "EXPENSE",
        amount_xof: totalAmount,
        balance_after_xof: newBal,
        reference: expenseNumber,
        category,
        description: `Dépense ${expenseNumber} : ${title} (${beneficiary || "Bénéficiaire divers"})`,
        related_entity_type: "EXPENSE",
        related_entity_id: createdExpense.id,
        performed_by_user_id: context.user.id,
      });
    }

    return NextResponse.json({
      success: true,
      expense: createdExpense,
      message: requiresApproval
        ? `Dépense ${expenseNumber} de ${totalAmount.toLocaleString("fr-FR")} FCFA enregistrée et soumise à validation du Gérant/Promoteur (dépassement du seuil de 100 000 FCFA).`
        : `Dépense ${expenseNumber} de ${totalAmount.toLocaleString("fr-FR")} FCFA enregistrée et décaissée avec succès.`,
    });
  } catch (err) {
    console.error("[expenses.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
