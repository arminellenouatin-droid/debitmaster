import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { normalizePhoneIdentifier } from "@/lib/auth-identifiers";

const validProviders = ["MTN", "MOOV", "ORANGE", "WAVE"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id: saleId } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sales.create");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const phone = typeof body.phone === "string" ? normalizePhoneIdentifier(body.phone) : "";
    const provider = typeof body.provider === "string" && validProviders.includes(body.provider.toUpperCase() as (typeof validProviders)[number])
      ? body.provider.toUpperCase()
      : "MTN";
    const amountXof = Math.max(0, Math.floor(Number(body.amountXof) || 0));

    if (!phone || phone.length < 8) {
      return NextResponse.json({ error: "Numéro de téléphone mobile money invalide." }, { status: 400 });
    }
    if (amountXof <= 0) {
      return NextResponse.json({ error: "Montant mobile money invalide." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: sale, error: saleErr } = await admin
      .from("couture_sales")
      .select("id, site_id, balance_amount_xof, status")
      .eq("id", saleId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (saleErr || !sale) {
      return NextResponse.json({ error: "Vente introuvable." }, { status: 404 });
    }

    if (sale.balance_amount_xof <= 0) {
      return NextResponse.json({ error: "Cette vente est déjà soldée." }, { status: 400 });
    }

    // Créer la demande Mobile Money (simulée / intégrée avec référence)
    const providerTxId = `MOMO-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const { data: momoRequest, error: insertErr } = await admin
      .from("couture_mobile_money_requests")
      .insert({
        tenant_id: context.tenantId,
        sale_id: saleId,
        site_id: sale.site_id,
        phone,
        provider,
        amount_xof: amountXof,
        status: "PENDING",
        provider_transaction_id: providerTxId,
        initiated_by: context.user.id,
      })
      .select()
      .single();

    if (insertErr || !momoRequest) {
      return NextResponse.json({ error: "Impossible de créer la demande Mobile Money." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.sale.momo_request",
      entityType: "couture_mobile_money_requests",
      entityId: momoRequest.id,
      metadata: {
        saleId,
        phone,
        provider,
        amountXof,
      },
    });

    return NextResponse.json({
      request: momoRequest,
      message: `Demande de paiement envoyée sur le ${phone} (${provider}). En attente de validation client.`,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id: saleId } = await params;
    const body = await request.json();
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sales.create");

    const status = body.status === "SUCCESSFUL" ? "SUCCESSFUL" : "FAILED";
    const admin = createSupabaseAdminClient();

    const { data: updatedReq, error } = await admin
      .from("couture_mobile_money_requests")
      .update({
        status,
        confirmed_at: status === "SUCCESSFUL" ? new Date().toISOString() : null,
      })
      .eq("id", requestId)
      .eq("sale_id", saleId)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error || !updatedReq) {
      return NextResponse.json({ error: "Demande Mobile Money introuvable." }, { status: 404 });
    }

    return NextResponse.json({ request: updatedReq });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
