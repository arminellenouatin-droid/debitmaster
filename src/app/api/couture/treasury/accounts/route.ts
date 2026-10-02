import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";

const validAccountTypes = ["CASH", "BANK", "MOBILE_MONEY", "POS", "PETTY_CASH"] as const;

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

    assertCouturePermission(context, "treasury.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_treasury_accounts")
      .select(`
        *,
        site:couture_sites!site_id (id, name, site_type, city)
      `)
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true });

    if (siteId) query = query.eq("site_id", siteId);

    const { data: accounts, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les comptes de trésorerie." }, { status: 500 });
    }

    return NextResponse.json({ accounts: accounts ?? [] });
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

    assertCouturePermission(context, "treasury.view");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
    const accountType = validAccountTypes.includes(body.accountType) ? body.accountType : "CASH";
    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "FCFA";
    const initialBalance = Math.max(0, Math.round(Number(body.initialBalance) || 0));
    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : null;

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Nom du compte obligatoire (au moins 2 caractères)." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: account, error: insertErr } = await admin
      .from("couture_treasury_accounts")
      .insert({
        tenant_id: context.tenantId,
        site_id: siteId,
        name,
        account_type: accountType,
        currency,
        initial_balance: initialBalance,
        current_balance: initialBalance,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (insertErr || !account) {
      return NextResponse.json({ error: "Impossible de créer le compte de trésorerie." }, { status: 500 });
    }

    // Si solde initial > 0, enregistrer la transaction initiale
    if (initialBalance > 0) {
      await admin.from("couture_treasury_transactions").insert({
        tenant_id: context.tenantId,
        account_id: account.id,
        transaction_type: "INCOME",
        amount: initialBalance,
        balance_after: initialBalance,
        currency,
        reference: "SOLDE_INITIAL",
        description: "Solde d'ouverture du compte",
        performed_by: context.user.id,
      });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.treasury.account_create",
      entityType: "couture_treasury_accounts",
      entityId: account.id,
      metadata: { name, accountType, currency, initialBalance },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
