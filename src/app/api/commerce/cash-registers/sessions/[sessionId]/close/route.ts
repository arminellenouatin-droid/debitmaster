import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await request.json();
    const countedCash = Math.max(0, Math.floor(Number(body.closingCashCounted) || 0));
    const differenceReason = typeof body.differenceReason === "string" ? body.differenceReason.trim() : null;

    const admin = createSupabaseAdminClient();

    // 1. Récupérer la session
    const { data: session, error: sessionErr } = await admin
      .from("cash_register_sessions")
      .select("id, tenant_id, cash_register_id, opened_by_user_id, opening_float, status")
      .eq("id", sessionId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: "Session introuvable." }, { status: 404 });
    }
    if (session.status !== "OPEN") {
      return NextResponse.json({ error: "Cette session est déjà clôturée." }, { status: 400 });
    }

    // 2. Calculer les encaissements en espèces et totaux sur cette session
    const { data: payments } = await admin
      .from("order_payments")
      .select("amount, payment_method")
      .eq("tenant_id", context.tenantId)
      .eq("session_id", sessionId);

    let cashPayments = 0;
    let totalCollected = 0;
    (payments ?? []).forEach((p) => {
      const amt = Number(p.amount) || 0;
      totalCollected += amt;
      if (p.payment_method === "CASH") {
        cashPayments += amt;
      }
    });

    // 3. Calculer les mouvements de caisse (entrées/sorties diverses, dépenses)
    const { data: movements } = await admin
      .from("cash_movements")
      .select("amount, movement_type")
      .eq("tenant_id", context.tenantId)
      .eq("session_id", sessionId);

    let netMovementAdjustment = 0;
    (movements ?? []).forEach((m) => {
      const amt = Number(m.amount) || 0;
      if (m.movement_type === "CASH_IN") {
        netMovementAdjustment += amt;
      } else {
        netMovementAdjustment -= amt;
      }
    });

    const openingFloat = Number(session.opening_float) || 0;
    const expectedCash = Math.max(0, openingFloat + cashPayments + netMovementAdjustment);
    const cashDifference = countedCash - expectedCash;

    // Si écart et aucun motif fourni, exiger une justification
    if (cashDifference !== 0 && !differenceReason) {
      return NextResponse.json(
        {
          error: `Un écart de caisse de ${cashDifference > 0 ? "+" : ""}${cashDifference} FCFA a été constaté. Une justification est obligatoire.`,
          expectedCash,
          cashDifference,
        },
        { status: 422 }
      );
    }

    // 4. Clôturer la session
    const closedAt = new Date().toISOString();
    const { data: updated, error: updateErr } = await admin
      .from("cash_register_sessions")
      .update({
        status: "CLOSED",
        closed_by_user_id: context.user.id,
        closed_at: closedAt,
        expected_cash: expectedCash,
        closing_cash_counted: countedCash,
        cash_difference: cashDifference,
        difference_reason: differenceReason,
        total_collected: totalCollected,
        total_payments_count: (payments ?? []).length,
        updated_at: closedAt,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error("[sessions.close] update failed", updateErr);
      return NextResponse.json({ error: "Impossible de clôturer la session." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ticketZ: {
        sessionId: updated.id,
        openedAt: updated.opened_at,
        closedAt: updated.closed_at,
        openingFloat,
        totalCollected,
        cashPayments,
        netMovementAdjustment,
        expectedCash,
        closingCashCounted: countedCash,
        cashDifference,
        differenceReason,
        paymentsCount: (payments ?? []).length,
      },
    });
  } catch (cause) {
    console.error("[sessions.close] error", cause);
    return NextResponse.json({ error: "Erreur serveur lors de la clôture." }, { status: 500 });
  }
}
