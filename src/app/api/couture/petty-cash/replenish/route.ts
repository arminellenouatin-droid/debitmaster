import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { calculatePettyCashReplenishment, PETTY_CASH_DEFAULT_FUND_XOF } from "@/lib/couture-supplies";

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

    assertCouturePermission(context, "petty_cash.visa");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    if (!siteId) {
      return NextResponse.json({ error: "Atelier (siteId) requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: fund } = await admin
      .from("couture_petty_cash_funds")
      .select("*")
      .eq("site_id", siteId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (!fund) {
      return NextResponse.json({ error: "Fonds de petite caisse introuvable." }, { status: 404 });
    }

    const currentBalance = Number(fund.current_balance_xof) || 0;
    const fundLimit = Number(fund.fund_limit_xof) || PETTY_CASH_DEFAULT_FUND_XOF;
    const replenishmentNeeded = calculatePettyCashReplenishment(currentBalance, fundLimit);

    if (replenishmentNeeded <= 0) {
      return NextResponse.json({ error: "Le fonds de petite caisse est déjà à son niveau maximum." }, { status: 400 });
    }

    // Réapprovisionner le fonds à son plafond
    const { data: updatedFund, error: updateErr } = await admin
      .from("couture_petty_cash_funds")
      .update({
        current_balance_xof: fundLimit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fund.id)
      .select()
      .single();

    if (updateErr || !updatedFund) {
      return NextResponse.json({ error: "Erreur lors du renouvellement de la petite caisse." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.petty_cash.replenish",
      entityType: "couture_petty_cash_funds",
      entityId: fund.id,
      metadata: {
        siteId,
        previousBalance: currentBalance,
        replenishmentAmount: replenishmentNeeded,
        newBalance: fundLimit,
      },
    });

    return NextResponse.json({
      success: true,
      fund: updatedFund,
      replenishedAmountXof: replenishmentNeeded,
      message: `Fonds de petite caisse renouvelé avec succès (+${replenishmentNeeded} FCFA). Nouveau solde : ${fundLimit} FCFA.`,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
