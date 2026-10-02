import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { generateCoutureTreasuryTransferNumber } from "@/lib/couture-accounting";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "treasury.view");

    const admin = createSupabaseAdminClient();
    const { data: transfers, error } = await admin
      .from("couture_treasury_transfers")
      .select(`
        *,
        source_account:couture_treasury_accounts!source_account_id (id, name, account_type, currency),
        destination_account:couture_treasury_accounts!destination_account_id (id, name, account_type, currency)
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les virements de trésorerie." }, { status: 500 });
    }

    return NextResponse.json({ transfers: transfers ?? [] });
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

    const sourceAccountId = typeof body.sourceAccountId === "string" ? body.sourceAccountId.trim() : "";
    const destinationAccountId = typeof body.destinationAccountId === "string" ? body.destinationAccountId.trim() : "";
    const amount = Math.max(1, Math.round(Number(body.amount) || 0));
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null;

    if (!sourceAccountId || !destinationAccountId) {
      return NextResponse.json({ error: "Comptes source et destination requis." }, { status: 400 });
    }
    if (sourceAccountId === destinationAccountId) {
      return NextResponse.json({ error: "Le compte source et le compte destination doivent être différents." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Charger et vérifier les deux comptes
    const { data: sourceAcc, error: srcErr } = await admin
      .from("couture_treasury_accounts")
      .select("*")
      .eq("id", sourceAccountId)
      .eq("tenant_id", context.tenantId)
      .single();

    const { data: destAcc, error: dstErr } = await admin
      .from("couture_treasury_accounts")
      .select("*")
      .eq("id", destinationAccountId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (srcErr || !sourceAcc || dstErr || !destAcc) {
      return NextResponse.json({ error: "Comptes de trésorerie introuvables." }, { status: 404 });
    }

    if (sourceAcc.current_balance < amount) {
      return NextResponse.json({
        error: `Solde insuffisant sur le compte source (${sourceAcc.name} : ${sourceAcc.current_balance} ${sourceAcc.currency}).`,
      }, { status: 400 });
    }

    // Taux de change si devises distinctes
    const exchangeRate = Number(body.exchangeRate) > 0 ? Number(body.exchangeRate) : 1.0;
    const convertedAmount = Math.max(1, Math.round(amount * exchangeRate));

    // Numéro séquentiel VIR-YYYY-XXXXXX
    const currentYear = new Date().getFullYear();
    const { count } = await admin
      .from("couture_treasury_transfers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId)
      .like("transfer_number", `VIR-${currentYear}-%`);

    const sequence = (count ?? 0) + 1;
    const transferNumber = generateCoutureTreasuryTransferNumber(sequence, currentYear);

    // 2. Débit compte source
    const newSourceBalance = sourceAcc.current_balance - amount;
    await admin
      .from("couture_treasury_accounts")
      .update({ current_balance: newSourceBalance, updated_at: new Date().toISOString() })
      .eq("id", sourceAccountId);

    await admin.from("couture_treasury_transactions").insert({
      tenant_id: context.tenantId,
      account_id: sourceAccountId,
      transaction_type: "TRANSFER_OUT",
      amount,
      balance_after: newSourceBalance,
      currency: sourceAcc.currency,
      reference: transferNumber,
      description: `Virement sortant vers ${destAcc.name}`,
      performed_by: context.user.id,
    });

    // 3. Crédit compte destination
    const newDestBalance = destAcc.current_balance + convertedAmount;
    await admin
      .from("couture_treasury_accounts")
      .update({ current_balance: newDestBalance, updated_at: new Date().toISOString() })
      .eq("id", destinationAccountId);

    await admin.from("couture_treasury_transactions").insert({
      tenant_id: context.tenantId,
      account_id: destinationAccountId,
      transaction_type: "TRANSFER_IN",
      amount: convertedAmount,
      balance_after: newDestBalance,
      currency: destAcc.currency,
      reference: transferNumber,
      description: `Virement entrant depuis ${sourceAcc.name}`,
      performed_by: context.user.id,
    });

    // 4. Enregistrement du virement
    const { data: transfer, error: trfErr } = await admin
      .from("couture_treasury_transfers")
      .insert({
        tenant_id: context.tenantId,
        transfer_number: transferNumber,
        source_account_id: sourceAccountId,
        destination_account_id: destinationAccountId,
        amount,
        source_currency: sourceAcc.currency,
        destination_currency: destAcc.currency,
        exchange_rate: exchangeRate,
        converted_amount: convertedAmount,
        status: "COMPLETED",
        notes,
        performed_by: context.user.id,
      })
      .select()
      .single();

    if (trfErr || !transfer) {
      return NextResponse.json({ error: "Erreur lors de l'enregistrement du virement." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.treasury.transfer",
      entityType: "couture_treasury_transfers",
      entityId: transfer.id,
      metadata: {
        transferNumber,
        amount,
        sourceAccount: sourceAcc.name,
        destinationAccount: destAcc.name,
      },
    });

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
