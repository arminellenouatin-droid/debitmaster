// DebitMaster quote requests: les activités hors boissons, repas et hébergement sont étudiées avant activation.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { requestHasSameOrigin } from "@/lib/request-security";

const baseActivities = new Set(["BEVERAGE", "FOOD", "LODGING", "BOISSONS", "REPAS", "AUBERGE"]);

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    const body = await request.json() as { tenantId?: string; requestedActivities?: unknown; notes?: unknown };
    const context = await getAuthorizationContext();
    if (!context.user || context.employeeId) return NextResponse.json({ error: "Seul le propriétaire peut demander une cotation." }, { status: 403 });
    const tenantId = typeof body.tenantId === "string" && context.allTenantIds.includes(body.tenantId) ? body.tenantId : context.allTenantIds[0] ?? "";
    if (!tenantId) return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });
    const requestedActivities = Array.isArray(body.requestedActivities) ? Array.from(new Set(body.requestedActivities.filter((value): value is string => typeof value === "string").map((value) => value.trim().toUpperCase()).filter(Boolean))).slice(0, 12) : [];
    if (!requestedActivities.length || requestedActivities.some((activity) => baseActivities.has(activity) || !/^[A-Z0-9_ -]{2,60}$/.test(activity))) return NextResponse.json({ error: "Sélectionnez au moins une activité complémentaire valide." }, { status: 400 });
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    const { data: company } = await context.supabase.from("companies").select("id,owner_user_id,activity_type").eq("id", tenantId).eq("owner_user_id", context.user.id).is("deleted_at", null).maybeSingle();
    if (!company) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    if (company.activity_type === "BOUTIQUE_COMMERCE" || company.activity_type === "ATELIER_COUTURE") return NextResponse.json({ error: "Cette activité possède une formule dédiée et ne nécessite pas de cotation." }, { status: 400 });
    const { data, error } = await context.supabase.from("subscription_quote_requests").insert({ tenant_id: tenantId, requested_by: context.user.id, requested_activities: requestedActivities, notes }).select("id,tenant_id,requested_activities,notes,status,quoted_amount,currency,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer la demande de cotation." }, { status: 500 });
    return NextResponse.json({ request: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Impossible de traiter la demande de cotation." }, { status: 400 });
  }
}
