import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import {
  coutureSyscohadaCatalog,
  coutureStandardJournals,
  type CoutureAccountType,
} from "@/lib/couture-accounting";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const accountClass = searchParams.get("accountClass");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "accounting.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_chart_of_accounts")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("is_active", true)
      .order("account_number", { ascending: true });

    if (accountClass && Number(accountClass) >= 1 && Number(accountClass) <= 9) {
      query = query.eq("account_class", Number(accountClass));
    }

    const { data: accounts, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger le plan comptable." }, { status: 500 });
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

    assertCouturePermission(context, "accounting.view");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Initialisation automatique du catalogue complet SYSCOHADA + Journaux
    if (body.action === "INITIALIZE") {
      // Insertion des journaux
      for (const journal of coutureStandardJournals) {
        await admin
          .from("couture_accounting_journals")
          .upsert({
            tenant_id: context.tenantId,
            code: journal.code,
            name: journal.name,
          }, { onConflict: "tenant_id, code" });
      }

      // Insertion des comptes
      const accountsToUpsert = coutureSyscohadaCatalog.map((acc) => ({
        tenant_id: context.tenantId,
        account_number: acc.accountNumber,
        account_name: acc.accountName,
        account_class: acc.accountClass,
        account_type: acc.accountType,
        is_active: true,
      }));

      for (const acc of accountsToUpsert) {
        await admin
          .from("couture_chart_of_accounts")
          .upsert(acc, { onConflict: "tenant_id, account_number" });
      }

      await writeCoutureAuditEvent({
        tenantId: context.tenantId,
        actorUserId: context.user.id,
        action: "couture.accounting.chart_initialize",
        entityType: "couture_chart_of_accounts",
        entityId: context.tenantId,
        metadata: {
          accountsCount: accountsToUpsert.length,
          journalsCount: coutureStandardJournals.length,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Plan comptable SYSCOHADA et journaux initialisés avec succès pour l'atelier de couture.",
        count: accountsToUpsert.length,
      });
    }

    // 2. Création d'un compte individuel personnalisé
    const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";
    const accountName = typeof body.accountName === "string" ? body.accountName.trim().slice(0, 160) : "";
    const accountClass = Number(body.accountClass) || Number(accountNumber.charAt(0)) || 1;
    const accountType: CoutureAccountType = ["ASSET", "LIABILITY", "EQUITY", "EXPENSE", "REVENUE", "OFF_BALANCE"].includes(body.accountType)
      ? body.accountType
      : "ASSET";

    if (!accountNumber || !/^[1-9][0-9]{1,5}$/.test(accountNumber)) {
      return NextResponse.json({ error: "Numéro de compte SYSCOHADA invalide (doit commencer par 1-9 et avoir 2 à 6 chiffres)." }, { status: 400 });
    }
    if (!accountName || accountName.length < 2) {
      return NextResponse.json({ error: "Libellé de compte requis (au moins 2 caractères)." }, { status: 400 });
    }

    const { data: account, error: accErr } = await admin
      .from("couture_chart_of_accounts")
      .insert({
        tenant_id: context.tenantId,
        account_number: accountNumber,
        account_name: accountName,
        account_class: accountClass,
        account_type: accountType,
        is_active: true,
      })
      .select()
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "Impossible de créer le compte comptable." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.accounting.account_create",
      entityType: "couture_chart_of_accounts",
      entityId: account.id,
      metadata: { accountNumber, accountName },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
