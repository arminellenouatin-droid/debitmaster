// DebitManager Gérant stock: read-only view of the active counter store for the authorized tenant.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter le stock." }, { status: 403 });
    if (!tenantId || !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    if (context.role === "GERANT" && !can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter le stock du Gérant." }, { status: 403 });

    const { data: store, error: storeError } = await supabase.from("inventory_stores").select("id,name,store_type,is_active").eq("tenant_id", tenantId).eq("store_type", "COUNTER").eq("is_active", true).order("created_at").limit(1).maybeSingle();
    if (storeError) return NextResponse.json({ error: "Impossible de charger le magasin du Gérant." }, { status: 500 });
    if (!store) return NextResponse.json({ store: null, stock: [], movements: [] });

    const { data: inventory, error: inventoryError } = await supabase.from("store_inventory").select("id,store_id,product_id,quantity,reserved_quantity,updated_at,products(id,name,unit,stock_family,price,alert_threshold,safety_threshold,category_id)").eq("tenant_id", tenantId).eq("store_id", store.id).order("updated_at", { ascending: false }).limit(200);
    if (inventoryError) return NextResponse.json({ error: "Impossible de charger les quantités du magasin du Gérant." }, { status: 500 });

    const { data: movements, error: movementError } = await supabase.from("stock_movements").select("id,product_id,movement_type,quantity,reason,created_at,products(name,unit)").eq("tenant_id", tenantId).eq("store_id", store.id).order("created_at", { ascending: false }).limit(50);
    if (movementError) return NextResponse.json({ error: "Impossible de charger les mouvements du magasin du Gérant." }, { status: 500 });

    return NextResponse.json({ store, stock: inventory ?? [], movements: movements ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}
