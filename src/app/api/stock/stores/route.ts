// DebitManager stores API: lieux physiques isolés par établissement, jamais partagés entre tenants.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

const counterName = "Magasin comptoir";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les magasins." }, { status: 403 });
    if (tenantId && !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    let query = context.supabase.from("inventory_stores").select("id,tenant_id,name,store_type,is_active,created_at,store_inventory(id,product_id,quantity,reserved_quantity,products(id,name,unit,stock_family,alert_threshold,safety_threshold))").eq("is_active", true).order("created_at", { ascending: true }).limit(50);
    query = tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", context.tenantIds);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les magasins." }, { status: 500 });
    return NextResponse.json({ stores: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!tenantId || name.length < 2) return NextResponse.json({ error: "Établissement et nom du magasin requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "products.manage")) return NextResponse.json({ error: "Permission insuffisante pour créer un magasin." }, { status: 403 });
    if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const storeType = name.toLocaleLowerCase("fr-FR") === counterName.toLocaleLowerCase("fr-FR") ? "COUNTER" : "GENERAL";
    const { data, error } = await context.supabase.from("inventory_stores").insert({ tenant_id: tenantId, name, store_type: storeType, created_by: context.user.id }).select("id,tenant_id,name,store_type,is_active,created_at").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Ce magasin existe déjà dans l’établissement." : "Impossible de créer le magasin." }, { status: 400 });
    return NextResponse.json({ store: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
