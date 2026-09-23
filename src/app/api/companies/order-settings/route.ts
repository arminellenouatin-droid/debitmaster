import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const context = await getAuthorizationContext();
  if (!context.user) return errorResponse("Authentification requise.", 401);
  if (context.employeeId) return errorResponse("Seul le propriétaire peut modifier ce réglage.", 403);
  const tenantId = new URL(request.url).searchParams.get("tenantId") ?? context.tenantIds[0] ?? "";
  if (!tenantId || !context.tenantIds.includes(tenantId)) return errorResponse("Établissement non autorisé.", 403);
  const { data, error } = await context.supabase.from("companies").select("id,zones_tables_enabled").eq("id", tenantId).eq("owner_user_id", context.user.id).is("deleted_at", null).maybeSingle();
  if (error || !data) return errorResponse("Établissement introuvable.", 404);
  return NextResponse.json({ tenantId: data.id, zonesTablesEnabled: data.zones_tables_enabled !== false });
}

export async function PATCH(request: Request) {
  const context = await getAuthorizationContext();
  if (!context.user) return errorResponse("Authentification requise.", 401);
  if (context.employeeId) return errorResponse("Seul le propriétaire peut modifier ce réglage.", 403);
  const body = await request.json().catch(() => null) as { tenantId?: unknown; zonesTablesEnabled?: unknown } | null;
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : "";
  if (!tenantId || !context.tenantIds.includes(tenantId)) return errorResponse("Établissement non autorisé.", 403);
  if (typeof body?.zonesTablesEnabled !== "boolean") return errorResponse("Le réglage zone/table est invalide.");
  const { data, error } = await context.supabase.from("companies").update({ zones_tables_enabled: body.zonesTablesEnabled, updated_at: new Date().toISOString() }).eq("id", tenantId).eq("owner_user_id", context.user.id).is("deleted_at", null).select("id,zones_tables_enabled").maybeSingle();
  if (error || !data) return errorResponse("Impossible d’enregistrer le réglage de l’établissement.", 500);
  return NextResponse.json({ tenantId: data.id, zonesTablesEnabled: data.zones_tables_enabled !== false });
}
