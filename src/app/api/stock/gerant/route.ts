// DebitManager Gérant stock: lecture seule du magasin comptoir, strictement limitée au tenant autorisé.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    if (!can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter le stock." }, { status: 403 });

    const admin = createSupabaseAdminClient();
    const { data: store, error: storeError } = await admin.from("inventory_stores").select("id,name,store_type,is_active").eq("tenant_id", tenantId).eq("store_type", "COUNTER").eq("is_active", true).order("created_at").limit(1).maybeSingle();
    if (storeError) {
      console.error("[stock/gerant.GET] store query failed", { code: storeError.code, message: storeError.message });
      return NextResponse.json({ error: "Impossible de charger le magasin du Gérant.", diagnostic: "GERANT_STORE_QUERY_FAILED" }, { status: 500 });
    }
    if (!store) return NextResponse.json({ store: null, stock: [], movements: [] });

    const [inventoryResult, movementsResult] = await Promise.all([
      admin.from("store_inventory").select("id,store_id,product_id,quantity,reserved_quantity,updated_at").eq("tenant_id", tenantId).eq("store_id", store.id).order("updated_at", { ascending: false }).limit(200),
      admin.from("stock_movements").select("id,product_id,movement_type,quantity,reason,created_at,store_id").eq("tenant_id", tenantId).eq("store_id", store.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (inventoryResult.error || movementsResult.error) {
      console.error("[stock/gerant.GET] inventory query failed", { inventory: inventoryResult.error?.message, movements: movementsResult.error?.message });
      return NextResponse.json({ error: "Impossible de charger les quantités du magasin du Gérant.", diagnostic: "GERANT_STOCK_QUERY_FAILED" }, { status: 500 });
    }

    const productIds = [...new Set([...(inventoryResult.data ?? []).map((item) => item.product_id), ...(movementsResult.data ?? []).map((item) => item.product_id)])];
    const productsResult = productIds.length ? await admin.from("products").select("id,name,unit,stock_family,price,alert_threshold,safety_threshold,category_id").eq("tenant_id", tenantId).in("id", productIds).is("deleted_at", null).limit(500) : { data: [], error: null };
    if (productsResult.error) {
      console.error("[stock/gerant.GET] products query failed", { code: productsResult.error.code, message: productsResult.error.message });
      return NextResponse.json({ error: "Impossible de charger les produits du magasin du Gérant.", diagnostic: "GERANT_STOCK_PRODUCTS_QUERY_FAILED" }, { status: 500 });
    }
    const productMap = new Map((productsResult.data ?? []).map((product) => [product.id, product]));
    const stock = (inventoryResult.data ?? []).map((item) => ({ ...item, products: productMap.get(item.product_id) ?? null }));
    const movements = (movementsResult.data ?? []).map((item) => ({ ...item, products: productMap.get(item.product_id) ? { name: productMap.get(item.product_id)!.name, unit: productMap.get(item.product_id)!.unit } : null }));
    return NextResponse.json({ store, stock, movements });
  } catch (error) {
    console.error("[stock/gerant.GET] unexpected error", error);
    return NextResponse.json({ error: "Service temporairement indisponible.", diagnostic: "GERANT_STOCK_UNEXPECTED_ERROR" }, { status: 500 });
  }
}
