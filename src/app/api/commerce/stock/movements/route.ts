import { NextResponse } from "next/server";
import { authorizeCommerceApi } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCommerceStore, isValidCommerceStockUuid } from "@/lib/commerce-stock";

function integerParam(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const auth = await authorizeCommerceApi(request, { permission: "stock.view", scope: "commerce:stock:movements:view" });
    if ("response" in auth) return auth.response;
    const { context } = auth;
    const storeId = params.get("storeId");
    const productId = params.get("productId");
    if (!isValidCommerceStockUuid(storeId)) return NextResponse.json({ error: "Magasin invalide." }, { status: 400 });
    if (!canAccessCommerceStore(context, storeId)) return NextResponse.json({ error: "Accès à ce magasin non autorisé." }, { status: 403 });
    if (productId && !isValidCommerceStockUuid(productId)) return NextResponse.json({ error: "Produit invalide." }, { status: 400 });

    const limit = Math.max(1, Math.min(integerParam(params.get("limit"), 25, 100), 100));
    const offset = integerParam(params.get("offset"), 0, 100000);
    const admin = createSupabaseAdminClient();
    let query = admin.from("commerce_stock_movements")
      .select("id,tenant_id,store_id,product_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,reference_label,actor_user_id,created_at", { count: "exact" })
      .eq("tenant_id", context.tenantId!)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (productId) query = query.eq("product_id", productId);
    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger l’historique des mouvements." }, { status: 500 });

    const productIds = [...new Set((data ?? []).map((row) => row.product_id))];
    const { data: products, error: productsError } = productIds.length
      ? await admin.from("commerce_products").select("id,name,internal_code,base_unit").eq("tenant_id", context.tenantId!).in("id", productIds).limit(100)
      : { data: [], error: null };
    if (productsError) return NextResponse.json({ error: "Impossible de charger les détails produits." }, { status: 500 });
    const productMap = new Map((products ?? []).map((product) => [product.id, product]));
    return NextResponse.json({
      movements: (data ?? []).map((movement) => ({ ...movement, product: productMap.get(movement.product_id) ?? null })),
      total: count ?? 0,
      offset,
      limit,
    });
  } catch {
    return NextResponse.json({ error: "Service Stock temporairement indisponible." }, { status: 500 });
  }
}
