// DebitMaster PawaPay Disbursement: transfert sortant des commissions d'affiliation par Mobile Money panafricain.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  initiatePayout,
  resolvePawaPayProvider,
  PawaPayError,
} from "@/lib/pawapay";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) {
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 }
      );
    }
    if (!context.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Accès super-administration requis." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      confirm?: boolean;
    };
    if (body.confirm !== true) {
      return NextResponse.json(
        { error: "Confirmation explicite du reversement requise." },
        { status: 400 }
      );
    }

    const { id } = await params;
    const admin = createSupabaseAdminClient();
    const { data: payout, error } = await admin
      .from("affiliate_payout_requests")
      .select(
        "id,amount,currency,status,payment_method,payment_account_ref,payout_reference"
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !payout) {
      return NextResponse.json(
        { error: "Demande de reversement introuvable." },
        { status: 404 }
      );
    }
    if (payout.status !== "APPROVED") {
      return NextResponse.json(
        {
          error:
            "La demande doit être approuvée avant le transfert Mobile Money.",
        },
        { status: 409 }
      );
    }
    if (payout.payment_method !== "MOBILE_MONEY") {
      return NextResponse.json(
        {
          error:
            "Cette demande est configurée pour un virement bancaire, pas pour Mobile Money.",
        },
        { status: 400 }
      );
    }
    if (payout.payout_reference) {
      return NextResponse.json({
        payout,
        status: "PENDING",
        referenceId: payout.payout_reference,
      });
    }

    try {
      const provider = resolvePawaPayProvider(payout.payment_account_ref);
      const initiated = await initiatePayout({
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency || "XOF",
        recipient: {
          type: "MMO",
          accountDetails: {
            phoneNumber: payout.payment_account_ref,
            provider,
          },
        },
        clientReferenceId: payout.id,
        customerMessage: "Com affilié DebitMaster".slice(0, 22),
      });

      const { data: updated, error: updateError } = await admin
        .from("affiliate_payout_requests")
        .update({
          payout_reference: initiated.payoutId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payout.id)
        .eq("status", "APPROVED")
        .is("payout_reference", null)
        .select("id,amount,currency,status,payment_method,payout_reference")
        .single();

      if (updateError || !updated) {
        return NextResponse.json(
          {
            error:
              "Transfert Mobile Money initié mais la référence locale n’a pas été enregistrée. Ne relancez pas sans vérifier le statut.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        payout: updated,
        status: "PENDING",
        referenceId: initiated.payoutId,
      });
    } catch (cause) {
      if (cause instanceof PawaPayError) {
        return NextResponse.json(
          { error: cause.message },
          { status: cause.status }
        );
      }
      return NextResponse.json(
        { error: "PawaPay n’a pas pu initialiser le reversement Mobile Money." },
        { status: 502 }
      );
    }
  } catch (cause) {
    if (cause instanceof PawaPayError) {
      return NextResponse.json(
        { error: cause.message },
        { status: cause.status }
      );
    }
    return NextResponse.json(
      { error: "Impossible d’initialiser le reversement PawaPay." },
      { status: 500 }
    );
  }
}
