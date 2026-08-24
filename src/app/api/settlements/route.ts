// DebitManager settlements: aucune sortie d’argent automatique; la demande reste VERIFYING pendant 4 heures.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId) || !can(context, "finance.view")) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await context.supabase.from("establishment_settlements").select("id,tenant_id,gross_amount,saas_fee_amount,net_amount,status,verification_ends_at,approved_at,paid_at,created_at,updated_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: "Impossible de charger les reversements." }, { status: 500 });
    return NextResponse.json({ settlements: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    if (!tenantId) return NextResponse.json({ error: "Établissement requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const configuredRate = Number(process.env.DEBITMASTER_SAAS_FEE_RATE ?? "10");
    const feeRate = Number.isFinite(configuredRate) ? configuredRate : 10;
    const { data, error } = await context.supabase.rpc("request_establishment_settlement", { p_tenant_id: tenantId, p_fee_rate: feeRate });
    if (error) {
      const message = error.message.includes("NO_AVAILABLE_FUNDS") ? "Aucun paiement Mobile Money disponible pour un reversement." : error.message.includes("OWNER_REQUIRED") ? "Seul le propriétaire de l’établissement peut demander un reversement." : "Impossible de préparer le reversement.";
      return NextResponse.json({ error: message }, { status: error.message.includes("OWNER_REQUIRED") ? 403 : 409 });
    }
    return NextResponse.json({ settlement: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
