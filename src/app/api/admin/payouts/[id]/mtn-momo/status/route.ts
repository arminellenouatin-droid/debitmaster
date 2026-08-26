// DebitManager MTN MoMo Disbursement status: aucune demande n’est marquée PAID avant confirmation du fournisseur.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTransferStatus, MtnMomoError } from "@/lib/mtn-momo";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.isPlatformAdmin) return NextResponse.json({ error: "Accès super-administration requis." }, { status: 403 });
    const { id } = await params;
    const admin = createSupabaseAdminClient();
    const { data: payout, error } = await admin.from("affiliate_payout_requests").select("id,amount,currency,status,payout_reference").eq("id", id).maybeSingle();
    if (error || !payout) return NextResponse.json({ error: "Demande de reversement introuvable." }, { status: 404 });
    if (!payout.payout_reference) return NextResponse.json({ payout, providerStatus: "NOT_STARTED" });
    if (payout.status === "PAID") return NextResponse.json({ payout, providerStatus: "SUCCESSFUL" });
    const providerPayload = await getTransferStatus(payout.payout_reference);
    const providerStatus = typeof providerPayload?.status === "string" ? providerPayload.status.toUpperCase() : "PENDING";
    if (providerStatus !== "SUCCESSFUL") return NextResponse.json({ payout, providerStatus });
    const { data: updated, error: updateError } = await admin.from("affiliate_payout_requests").update({ status: "PAID", updated_at: new Date().toISOString() }).eq("id", payout.id).eq("status", "APPROVED").select("id,amount,currency,status,payout_reference").maybeSingle();
    if (updateError) return NextResponse.json({ error: "Mise à jour du reversement impossible." }, { status: 500 });
    return NextResponse.json({ payout: updated ?? payout, providerStatus });
  } catch (cause) {
    if (cause instanceof MtnMomoError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    return NextResponse.json({ error: "Impossible de vérifier le reversement MTN MoMo." }, { status: 502 });
  }
}
