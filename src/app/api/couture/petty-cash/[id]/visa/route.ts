import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "petty_cash.visa");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const visaStatus = body.status === "REJECTED" ? "REJECTED" : "APPROVED";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;

    const admin = createSupabaseAdminClient();

    // 1. Charger la dépense
    const { data: expense, error: fetchErr } = await admin
      .from("couture_petty_cash_expenses")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .single();

    if (fetchErr || !expense) {
      return NextResponse.json({ error: "Dépense de petite caisse introuvable." }, { status: 404 });
    }

    if (expense.visa_status !== "PENDING") {
      return NextResponse.json({ error: `Cette dépense a déjà été visée (${expense.visa_status}).` }, { status: 400 });
    }

    // 2. Mettre à jour le visa
    const { data: updatedExpense, error: updateErr } = await admin
      .from("couture_petty_cash_expenses")
      .update({
        visa_status: visaStatus,
        visa_by_user_id: context.user.id,
        visa_at: new Date().toISOString(),
        visa_notes: notes,
      })
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (updateErr || !updatedExpense) {
      return NextResponse.json({ error: "Erreur lors de la mise à jour du visa." }, { status: 500 });
    }

    // 3. Si rejetée, recréditer le fonds de petite caisse
    if (visaStatus === "REJECTED") {
      const { data: fund } = await admin
        .from("couture_petty_cash_funds")
        .select("current_balance_xof")
        .eq("site_id", expense.site_id)
        .eq("tenant_id", context.tenantId)
        .single();

      if (fund) {
        await admin
          .from("couture_petty_cash_funds")
          .update({
            current_balance_xof: Number(fund.current_balance_xof) + Number(expense.amount_xof),
            updated_at: new Date().toISOString(),
          })
          .eq("site_id", expense.site_id)
          .eq("tenant_id", context.tenantId);
      }
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.petty_cash.visa",
      entityType: "couture_petty_cash_expenses",
      entityId: id,
      metadata: {
        expenseNumber: expense.expense_number,
        visaStatus,
        amountXof: expense.amount_xof,
      },
    });

    return NextResponse.json({
      success: true,
      expense: updatedExpense,
      message: visaStatus === "APPROVED" ? "Dépense visée et approuvée par le comptable." : "Dépense rejetée. Montant restitué au solde de la petite caisse.",
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
