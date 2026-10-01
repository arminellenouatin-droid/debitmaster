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

    const { data: transfers, error } = await admin
      .from("commerce_treasury_transfers")
      .select(`
        id, transfer_number, source_account_id, destination_account_id,
        amount_xof, transfer_fee_xof, status, notes, created_at,
        source_account:commerce_treasury_accounts!commerce_treasury_transfers_source_account_id_fkey(name, account_type),
        destination_account:commerce_treasury_accounts!commerce_treasury_transfers_destination_account_id_fkey(name, account_type)
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[treasury/transfers.GET] error", error);
      return NextResponse.json({ error: "Impossible de récupérer les virements internes." }, { status: 500 });
    }

    return NextResponse.json({ transfers: transfers || [] });
  } catch (err) {
    console.error("[treasury/transfers.GET] unexpected error", err);
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
    const { sourceAccountId, destinationAccountId, amountXof, transferFeeXof = 0, notes } = body;

    if (!sourceAccountId || !destinationAccountId || !amountXof) {
      return NextResponse.json({ error: "Comptes source, destination et montant obligatoires." }, { status: 400 });
    }

    if (sourceAccountId === destinationAccountId) {
      return NextResponse.json({ error: "Les comptes source et destination doivent être différents." }, { status: 400 });
    }

    const amount = Math.round(Number(amountXof));
    const fee = Math.max(0, Math.round(Number(transferFeeXof) || 0));

    if (amount <= 0) {
      return NextResponse.json({ error: "Le montant du virement doit être strictement positif." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Vérifier les deux comptes
    const { data: sourceAcc, error: srcErr } = await admin
      .from("commerce_treasury_accounts")
      .select("id, name, current_balance_xof")
      .eq("id", sourceAccountId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (srcErr || !sourceAcc) {
      return NextResponse.json({ error: "Compte source introuvable." }, { status: 404 });
    }

    const totalDebit = amount + fee;
    if (Number(sourceAcc.current_balance_xof) < totalDebit) {
      return NextResponse.json({
        error: `Solde insuffisant sur le compte source (${sourceAcc.name} : ${sourceAcc.current_balance_xof} FCFA disponibles, ${totalDebit} FCFA requis avec frais).`,
      }, { status: 400 });
    }

    const { data: destAcc, error: dstErr } = await admin
      .from("commerce_treasury_accounts")
      .select("id, name, current_balance_xof")
      .eq("id", destinationAccountId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (dstErr || !destAcc) {
      return NextResponse.json({ error: "Compte destination introuvable." }, { status: 404 });
    }

    // 2. Générer le numéro séquentiel VIR
    let transferNumber: string;
    try {
      const { data: numData, error: numErr } = await admin.rpc("next_document_number", {
        p_tenant_id: context.tenantId,
        p_doc_type: "TREASURY_TRANSFER",
      });
      if (numErr || !numData) {
        transferNumber = `VIR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      } else {
        transferNumber = numData;
      }
    } catch {
      transferNumber = `VIR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }

    const now = new Date().toISOString();
    const newSourceBalance = Number(sourceAcc.current_balance_xof) - totalDebit;
    const newDestBalance = Number(destAcc.current_balance_xof) + amount;

    // 3. Mettre à jour les soldes
    await admin
      .from("commerce_treasury_accounts")
      .update({ current_balance_xof: newSourceBalance, updated_at: now })
      .eq("id", sourceAccountId);

    await admin
      .from("commerce_treasury_accounts")
      .update({ current_balance_xof: newDestBalance, updated_at: now })
      .eq("id", destinationAccountId);

    // 4. Insérer le virement
    const { data: createdTransfer, error: trfErr } = await admin
      .from("commerce_treasury_transfers")
      .insert({
        tenant_id: context.tenantId,
        transfer_number: transferNumber,
        source_account_id: sourceAccountId,
        destination_account_id: destinationAccountId,
        amount_xof: amount,
        transfer_fee_xof: fee,
        status: "COMPLETED",
        notes: notes ? String(notes).trim() : null,
        created_by_user_id: context.user.id,
      })
      .select()
      .single();

    if (trfErr || !createdTransfer) {
      console.error("[treasury/transfers.POST] insert error", trfErr);
      return NextResponse.json({ error: "Échec d'enregistrement du virement." }, { status: 500 });
    }

    // 5. Consigner les transactions de trésorerie (source + destination)
    await admin.from("commerce_treasury_transactions").insert([
      {
        tenant_id: context.tenantId,
        account_id: sourceAccountId,
        transaction_type: "TRANSFER_OUT",
        amount_xof: totalDebit,
        balance_after_xof: newSourceBalance,
        reference: transferNumber,
        category: "VIREMENT_INTERNE",
        description: `Virement sortant vers ${destAcc.name}${fee > 0 ? ` (dont ${fee} FCFA de frais)` : ""}`,
        related_entity_type: "TRANSFER",
        related_entity_id: createdTransfer.id,
        performed_by_user_id: context.user.id,
      },
      {
        tenant_id: context.tenantId,
        account_id: destinationAccountId,
        transaction_type: "TRANSFER_IN",
        amount_xof: amount,
        balance_after_xof: newDestBalance,
        reference: transferNumber,
        category: "VIREMENT_INTERNE",
        description: `Virement entrant depuis ${sourceAcc.name}`,
        related_entity_type: "TRANSFER",
        related_entity_id: createdTransfer.id,
        performed_by_user_id: context.user.id,
      },
    ]);

    return NextResponse.json({
      success: true,
      transfer: createdTransfer,
      message: `Virement interne ${transferNumber} de ${amount.toLocaleString("fr-FR")} FCFA effectué avec succès.`,
    });
  } catch (err) {
    console.error("[treasury/transfers.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
