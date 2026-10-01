import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    // 1. Contrôle d'accès et séparation des tâches (Gérant ou Promoteur requis)
    const isManagerOrAdmin =
      ["ADMINISTRATEUR", "GERANT", "SUPERVISEUR"].includes(context.role || "") ||
      context.permissions.has("expenses.approve");

    if (!isManagerOrAdmin) {
      return NextResponse.json({
        error: "Accès refusé. Seul le Promoteur ou le Gérant peut valider une dépense excédant le seuil d'approbation.",
      }, { status: 403 });
    }

    const { id: expenseId } = await params;
    const admin = createSupabaseAdminClient();

    // 2. Récupérer la dépense
    const { data: expense, error: expErr } = await admin
      .from("commerce_expenses")
      .select("id, expense_number, title, total_amount_xof, paid_from_account_id, status, category, beneficiary")
      .eq("id", expenseId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (expErr || !expense) {
      return NextResponse.json({ error: "Dépense introuvable." }, { status: 404 });
    }

    if (expense.status !== "PENDING_APPROVAL") {
      return NextResponse.json({
        error: `Cette dépense ne peut pas être approuvée (statut actuel : ${expense.status}).`,
      }, { status: 400 });
    }

    // 3. Vérifier le compte de trésorerie payeur
    const totalAmount = Number(expense.total_amount_xof);
    const { data: account, error: accErr } = await admin
      .from("commerce_treasury_accounts")
      .select("id, name, current_balance_xof")
      .eq("id", expense.paid_from_account_id)
      .eq("tenant_id", context.tenantId)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "Compte de trésorerie payeur introuvable." }, { status: 404 });
    }

    if (Number(account.current_balance_xof) < totalAmount) {
      return NextResponse.json({
        error: `Solde insuffisant sur le compte ${account.name} (${Number(account.current_balance_xof).toLocaleString("fr-FR")} FCFA disponibles, ${totalAmount.toLocaleString("fr-FR")} FCFA requis).`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newBal = Number(account.current_balance_xof) - totalAmount;

    // 4. Mettre à jour le solde du compte
    await admin
      .from("commerce_treasury_accounts")
      .update({ current_balance_xof: newBal, updated_at: now })
      .eq("id", account.id);

    // 5. Consigner la transaction de trésorerie
    await admin.from("commerce_treasury_transactions").insert({
      tenant_id: context.tenantId,
      account_id: account.id,
      transaction_type: "EXPENSE",
      amount_xof: totalAmount,
      balance_after_xof: newBal,
      reference: expense.expense_number,
      category: expense.category,
      description: `Dépense approuvée ${expense.expense_number} : ${expense.title} (${expense.beneficiary || "Bénéficiaire divers"})`,
      related_entity_type: "EXPENSE",
      related_entity_id: expense.id,
      performed_by_user_id: context.user.id,
    });

    // 6. Mettre à jour le statut de la dépense
    const { data: updatedExpense, error: updateErr } = await admin
      .from("commerce_expenses")
      .update({
        status: "PAID",
        approved_by_user_id: context.user.id,
        approved_at: now,
        updated_at: now,
      })
      .eq("id", expense.id)
      .select()
      .single();

    if (updateErr) {
      console.error("[expenses.approve] update failed", updateErr);
      return NextResponse.json({ error: "Échec de validation de la dépense." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      expense: updatedExpense,
      message: `Dépense ${expense.expense_number} de ${totalAmount.toLocaleString("fr-FR")} FCFA approuvée et décaissée avec succès.`,
    });
  } catch (err) {
    console.error("[expenses.approve] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
