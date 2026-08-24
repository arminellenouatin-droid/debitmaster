// DebitManager tables API: every read and write is bounded by the authorized tenant and tables RBAC permissions.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

const statuses = ["FREE", "OCCUPIED", "RESERVED"] as const;
type TableStatus = (typeof statuses)[number];

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "tables.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter le plan de salle." }, { status: 403 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const query = supabase.from("dining_tables").select("id,tenant_id,label,zone,capacity,status,created_at,updated_at").is("deleted_at", null).order("zone").order("label").limit(100);
    const { data, error } = await (tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", tenantIds));
    if (error) return NextResponse.json({ error: "Impossible de charger le plan de salle." }, { status: 500 });
    return NextResponse.json({ tables: data ?? [], statuses });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
    const zone = typeof body.zone === "string" ? body.zone.trim().slice(0, 80) : null;
    const capacity = Number(body.capacity);
    if (!tenantId || label.length < 1 || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) return NextResponse.json({ error: "Établissement, libellé et capacité valide requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "tables.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer les tables." }, { status: 403 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await supabase.from("dining_tables").insert({ tenant_id: tenantId, label, zone, capacity, status: "FREE" }).select("id,tenant_id,label,zone,capacity,status,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: "Impossible de créer la table. Le libellé existe peut-être déjà." }, { status: 400 });
    return NextResponse.json({ table: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const tableId = typeof body.tableId === "string" ? body.tableId : "";
    const status = typeof body.status === "string" ? body.status : "";
    if (!tenantId || !tableId || !statuses.includes(status as TableStatus)) return NextResponse.json({ error: "Table, établissement et statut valide requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "tables.manage")) return NextResponse.json({ error: "Permission insuffisante pour modifier le statut d’une table." }, { status: 403 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await supabase.from("dining_tables").update({ status, updated_at: new Date().toISOString() }).eq("id", tableId).eq("tenant_id", tenantId).is("deleted_at", null).select("id,tenant_id,label,zone,capacity,status,created_at,updated_at").single();
    if (error || !data) return NextResponse.json({ error: "Impossible de modifier cette table." }, { status: 400 });
    return NextResponse.json({ table: data });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
