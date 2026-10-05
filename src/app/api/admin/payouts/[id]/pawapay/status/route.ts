// DebitMaster PawaPay Disbursement status: vérification du virement sortant Mobile Money via PawaPay.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPayoutStatus, PawaPayError } from "@/lib/pawapay";

export const dynamic = "force-dynamic";

export async function GET(
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

    const { id } = await params;
    const admin = createSupabaseAdminClient();
    const { data: payout, error } = await admin
      .from("affiliate_payout_requests")
      .select("id,amount,currency,status,payout_reference")
      .eq("id", id)
      .maybeSingle();

    if (error || !payout) {
      return NextResponse.json(
        { error: "Demande de reversement introuvable." },
        { status: 404 }
      );
    }
    if (!payout.payout_reference) {
      return NextResponse.json({ payout, providerStatus: "NOT_STARTED" });
    }
    if (payout.status === "PAID") {
      return NextResponse.json({ payout, providerStatus: "COMPLETED" });
    }

    try {
      const check = await getPayoutStatus(payout.payout_reference);
      const providerStatus = check.status;

      if (providerStatus === "COMPLETED") {
        const { data: updated, error: updateError } = await admin
          .from("affiliate_payout_requests")
          .update({ status: "PAID", updated_at: new Date().toISOString() })
          .eq("id", payout.id)
          .eq("status", "APPROVED")
          .select("id,amount,currency,status,payout_reference")
          .maybeSingle();

        if (updateError) {
          return NextResponse.json(
            { error: "Mise à jour du reversement impossible." },
            { status: 500 }
          );
        }
        return NextResponse.json({ payout: updated ?? payout, providerStatus });
      }

      if (providerStatus === "FAILED" || providerStatus === "REJECTED") {
        await admin
          .from("affiliate_payout_requests")
          .update({ status: "REJECTED", updated_at: new Date().toISOString() })
          .eq("id", payout.id)
          .eq("status", "APPROVED");
      }

      return NextResponse.json({ payout, providerStatus });
    } catch (checkErr) {
      return NextResponse.json({ payout, providerStatus: "PENDING" });
    }
  } catch (cause) {
    if (cause instanceof PawaPayError) {
      return NextResponse.json(
        { error: cause.message },
        { status: cause.status }
      );
    }
    return NextResponse.json(
      { error: "Impossible de vérifier le reversement PawaPay." },
      { status: 502 }
    );
  }
}
