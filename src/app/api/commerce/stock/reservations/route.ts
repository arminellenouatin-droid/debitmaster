import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCommerceStore, commerceStockRpcError, isValidCommerceStockUuid, validateCommerceStockReservation } from "@/lib/commerce-stock";

function integerParam(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const auth = await authorizeCommerceApi(request, { permission: "stock.view", scope: "commerce:stock:reservations:view" });
    if ("response" in auth) return auth.response;
    const { context } = auth;
    const storeId = params.get("storeId");
    if (storeId && !isValidCommerceStockUuid(storeId)) return NextResponse.json({ error: "Magasin invalide." }, { status: 400 });
    if (storeId && !canAccessCommerceStore(context, storeId)) return NextResponse.json({ error: "Accès à ce magasin non autorisé." }, { status: 403 });
    if (!context.isOwner && context.storeIds.length === 0) return NextResponse.json({ reservations: [], total: 0, offset: 0, limit: 50 });

    const admin = createSupabaseAdminClient();
    const limit = Math.max(1, Math.min(integerParam(params.get("limit"), 50, 100), 100));
    const offset = integerParam(params.get("offset"), 0, 100000);
    const status = params.get("status") ?? "ACTIVE";
    if (!["ALL", "ACTIVE", "RELEASED", "EXPIRED", "CONSUMED"].includes(status)) {
      return NextResponse.json({ error: "État de réservation invalide." }, { status: 400 });
    }
    let query = admin.from("commerce_stock_reservations")
      .select("id,tenant_id,store_id,product_id,quantity,status,reference_label,idempotency_key,expires_at,created_by,released_by,created_at,updated_at", { count: "exact" })
      .eq("tenant_id", context.tenantId!)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (storeId) query = query.eq("store_id", storeId);
    else if (!context.isOwner) query = query.in("store_id", context.storeIds);
    if (status !== "ALL") query = query.eq("status", status);
    if (status === "ACTIVE") query = query.gt("expires_at", new Date().toISOString());
    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les réservations." }, { status: 500 });

    const productIds = [...new Set((data ?? []).map((row) => row.product_id))];
    const storeIds = [...new Set((data ?? []).map((row) => row.store_id))];
    const [{ data: products, error: productsError }, { data: stores, error: storesError }] = await Promise.all([
      productIds.length ? admin.from("commerce_products").select("id,name,internal_code,base_unit").eq("tenant_id", context.tenantId!).in("id", productIds).limit(100) : Promise.resolve({ data: [], error: null }),
      storeIds.length ? admin.from("commerce_stores").select("id,name").eq("tenant_id", context.tenantId!).in("id", storeIds).limit(100) : Promise.resolve({ data: [], error: null }),
    ]);
    if (productsError || storesError) return NextResponse.json({ error: "Impossible de charger les détails des réservations." }, { status: 500 });
    const productMap = new Map((products ?? []).map((product) => [product.id, product]));
    const storeMap = new Map((stores ?? []).map((store) => [store.id, store]));
    return NextResponse.json({
      reservations: (data ?? []).map((reservation) => ({
        ...reservation,
        status: reservation.status === "ACTIVE" && new Date(reservation.expires_at).getTime() <= Date.now() ? "EXPIRED" : reservation.status,
        product: productMap.get(reservation.product_id) ?? null,
        store: storeMap.get(reservation.store_id) ?? null,
      })),
      total: count ?? 0,
      offset,
      limit,
    });
  } catch {
    return NextResponse.json({ error: "Service Stock temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = await readCommerceJson(request, 8 * 1024);
  if (parsed.response) return parsed.response;
  let reservation: ReturnType<typeof validateCommerceStockReservation>;
  try {
    reservation = validateCommerceStockReservation(parsed.body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Réservation invalide." }, { status: 400 });
  }
  const auth = await authorizeCommerceApi(request, {
    tenantId: reservation.tenantId,
    permission: "stock.manage",
    write: true,
    scope: "commerce:stock:reservation:create",
  });
  if ("response" in auth) return auth.response;
  if (!canAccessCommerceStore(auth.context, reservation.storeId)) return NextResponse.json({ error: "Accès à ce magasin non autorisé." }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("create_commerce_stock_reservation", {
    p_tenant_id: reservation.tenantId,
    p_store_id: reservation.storeId,
    p_product_id: reservation.productId,
    p_quantity: reservation.quantity,
    p_reference_label: reservation.referenceLabel,
    p_idempotency_key: reservation.idempotencyKey,
    p_actor_user_id: auth.context.user!.id,
  });
  if (error) {
    const mapped = commerceStockRpcError(error);
    if (mapped.status >= 500) console.error("[commerce.stock.reservation] failed", { code: error.code });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
  const idempotent = Boolean(data && typeof data === "object" && "idempotent" in data && data.idempotent);
  return NextResponse.json({ reservation: data }, { status: idempotent ? 200 : 201 });
}
