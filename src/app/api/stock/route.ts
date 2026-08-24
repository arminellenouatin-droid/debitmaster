// DebitManager stock API: lecture et mouvements bornés par les établissements possédés par la session.
import { NextResponse } from "next/server";
import { getOwnedTenantIds } from "@/lib/tenants";

const movementTypes = ["IN_PURCHASE", "OUT_SALE", "OUT_LOSS", "OUT_BREAKAGE", "OUT_EXPIRY", "ADJUSTMENT"] as const;

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const query = supabase.from("products").select("id,tenant_id,name,product_type,unit,current_stock,alert_threshold,safety_threshold").is("deleted_at", null).order("name").limit(100);
    const { data, error } = await (tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", tenantIds));
    if (error) return NextResponse.json({ error: "Impossible de charger le stock." }, { status: 500 });
    return NextResponse.json({ stock: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    const movementType = typeof body.movementType === "string" ? body.movementType : "";
    const quantity = Number(body.quantity);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 240) : null;
    if (!tenantId || !productId || !movementTypes.includes(movementType as (typeof movementTypes)[number]) || !Number.isInteger(quantity) || quantity <= 0) return NextResponse.json({ error: "Produit, type de mouvement et quantité positive requis." }, { status: 400 });
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data: product } = await supabase.from("products").select("id,current_stock").eq("id", productId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle();
    if (!product) return NextResponse.json({ error: "Produit non autorisé." }, { status: 403 });
    const signedQuantity = movementType === "IN_PURCHASE" || movementType === "ADJUSTMENT" ? quantity : -quantity;
    if (product.current_stock + signedQuantity < 0) return NextResponse.json({ error: "Stock insuffisant pour ce mouvement." }, { status: 400 });
    const { data: movement, error: movementError } = await supabase.from("stock_movements").insert({ tenant_id: tenantId, product_id: productId, movement_type: movementType, quantity: signedQuantity, reason, responsible_user_id: user.id }).select("id,tenant_id,product_id,movement_type,quantity,reason,created_at").single();
    if (movementError) return NextResponse.json({ error: "Impossible d’enregistrer le mouvement." }, { status: 400 });
    const { error: productError } = await supabase.from("products").update({ current_stock: product.current_stock + signedQuantity, updated_at: new Date().toISOString() }).eq("id", productId).eq("tenant_id", tenantId);
    if (productError) return NextResponse.json({ error: "Mouvement enregistré mais mise à jour du stock incomplète. Vérifiez ce produit." }, { status: 500 });
    return NextResponse.json({ movement, currentStock: product.current_stock + signedQuantity }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
