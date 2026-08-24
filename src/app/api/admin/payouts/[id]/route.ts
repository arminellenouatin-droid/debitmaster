// Design Read: action financière sensible, confirmation explicite, statut monotone et aucune modification silencieuse.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthorizationContext();
  if (!context.user) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  if (!context.isPlatformAdmin) return NextResponse.json({ error: "Accès super-administration requis" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: string; rejectionReason?: string } | null;
  if (body?.status !== "APPROVED" && body?.status !== "REJECTED") return NextResponse.json({ error: "Statut de revue invalide" }, { status: 400 });
  const { data, error } = await context.supabase.from("affiliate_payout_requests").update({ status: body.status, reviewed_at: new Date().toISOString(), reviewed_by: context.user.id, rejection_reason: body.status === "REJECTED" ? (body.rejectionReason?.trim() || "Demande refusée par la plateforme") : null }).eq("id", id).eq("status", "PENDING").select("id,status,reviewed_at,rejection_reason").maybeSingle();
  if (error) return NextResponse.json({ error: "Mise à jour de la demande impossible" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Demande absente ou déjà traitée" }, { status: 409 });
  return NextResponse.json({ payout: data });
}
