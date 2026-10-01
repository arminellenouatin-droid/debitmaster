import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canAccessCommerceStore,
  commerceStockRpcError,
  isValidCommerceStockUuid,
  safeCommerceStockSearch,
  validateCommerceStockMovement,
} from "@/lib/commerce-stock";

const alertStatuses = new Set(["OUT_OF_STOCK", "LOW_STOCK", "OVERSTOCK", "HEALTHY"]);
const stockColumns = "tenant_id,store_id,store_name,product_id,product_name,internal_code,barcode,base_unit,product_status,min_stock,max_stock,reorder_point,physical_quantity,reserved_quantity,available_quantity,alert_status";

function boundedInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const auth = await authorizeCommerceApi(request, { permission: "stock.view", scope: "commerce:stock:view" });
    if ("response" in auth) return auth.response;
    const { context } = auth;
    const admin = createSupabaseAdminClient();

    let storesQuery = admin.from("commerce_stores")
      .select("id,name,store_type,city,status")
      .eq("tenant_id", context.tenantId!)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true })
      .limit(100);
    if (!context.isOwner) {
      if (context.storeIds.length === 0) return NextResponse.json({ stores: [], rows: [], total: 0, settings: null });
      storesQuery = storesQuery.in("id", context.storeIds);
    }
    const { data: stores, error: storeError } = await storesQuery;
    if (storeError) return NextResponse.json({ error: "Impossible de charger les magasins autorisés." }, { status: 500 });

    const storeId = params.get("storeId");
    if (!storeId) return NextResponse.json({ stores: stores ?? [], rows: [], total: 0, settings: await readSettings(admin, context.tenantId!) });
    if (!isValidCommerceStockUuid(storeId)) return NextResponse.json({ error: "Magasin invalide." }, { status: 400 });
    if (!canAccessCommerceStore(context, storeId)) return NextResponse.json({ error: "Accès à ce magasin non autorisé." }, { status: 403 });
    if (!(stores ?? []).some((store) => store.id === storeId)) return NextResponse.json({ error: "Magasin actif introuvable." }, { status: 404 });

    const limit = Math.max(1, Math.min(boundedInteger(params.get("limit"), 50, 100), 100));
    const offset = boundedInteger(params.get("offset"), 0, 100000);
    const status = params.get("status") ?? "ALL";
    if (status !== "ALL" && !alertStatuses.has(status)) return NextResponse.json({ error: "État de stock invalide." }, { status: 400 });
    const q = safeCommerceStockSearch(params.get("q"));
    let query = admin.from("commerce_stock_levels")
      .select(stockColumns, { count: "exact" })
      .eq("tenant_id", context.tenantId!)
      .eq("store_id", storeId)
      .order("product_name", { ascending: true })
      .range(offset, offset + limit - 1);
    if (status !== "ALL" && alertStatuses.has(status)) query = query.eq("alert_status", status);
    if (q) query = query.or(`product_name.ilike.%${q}%,internal_code.ilike.%${q}%,barcode.ilike.%${q}%`);
    const [{ data: rows, error, count: totalCount }, { data: settings, error: settingsError }, ...counts] = await Promise.all([
      query,
      admin.from("commerce_stock_settings").select("allow_negative_stock,reservation_duration_minutes").eq("tenant_id", context.tenantId!).maybeSingle(),
      ...["OUT_OF_STOCK", "LOW_STOCK", "OVERSTOCK"].map((alertStatus) => admin.from("commerce_stock_levels").select("product_id", { count: "exact", head: true }).eq("tenant_id", context.tenantId!).eq("store_id", storeId).eq("alert_status", alertStatus)),
    ]);
    if (error || settingsError || counts.some((result) => result.error)) return NextResponse.json({ error: "Impossible de charger les niveaux et alertes de stock." }, { status: 500 });
    return NextResponse.json({
      stores: stores ?? [],
      rows: rows ?? [],
      total: totalCount ?? 0,
      settings: settings ?? { allow_negative_stock: false, reservation_duration_minutes: 1440 },
      alerts: {
        outOfStock: counts[0]?.count ?? 0,
        lowStock: counts[1]?.count ?? 0,
        overstock: counts[2]?.count ?? 0,
      },
      offset,
      limit,
    });
  } catch {
    return NextResponse.json({ error: "Service Stock temporairement indisponible." }, { status: 500 });
  }
}

async function readSettings(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string) {
  const { data, error } = await admin.from("commerce_stock_settings")
    .select("allow_negative_stock,reservation_duration_minutes")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { allow_negative_stock: false, reservation_duration_minutes: 1440 };
}

export async function POST(request: Request) {
  const parsed = await readCommerceJson(request, 8 * 1024);
  if (parsed.response) return parsed.response;
  let movement: ReturnType<typeof validateCommerceStockMovement>;
  try {
    movement = validateCommerceStockMovement(parsed.body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mouvement invalide." }, { status: 400 });
  }
  const permission = movement.movementType === "RECEIPT" ? "stock.receive" : movement.movementType === "ISSUE" ? "stock.issue" : "stock.manage";
  const auth = await authorizeCommerceApi(request, {
    tenantId: movement.tenantId,
    permission,
    write: true,
    scope: `commerce:stock:${movement.movementType.toLowerCase()}`,
  });
  if ("response" in auth) return auth.response;
  const { context } = auth;
  if (!canAccessCommerceStore(context, movement.storeId)) return NextResponse.json({ error: "Accès à ce magasin non autorisé." }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("record_commerce_stock_movement", {
    p_tenant_id: movement.tenantId,
    p_store_id: movement.storeId,
    p_product_id: movement.productId,
    p_movement_type: movement.movementType,
    p_quantity: movement.quantity,
    p_reason: movement.reason,
    p_reference_label: movement.referenceLabel,
    p_idempotency_key: movement.idempotencyKey,
    p_actor_user_id: context.user!.id,
  });
  if (error) {
    const mapped = commerceStockRpcError(error);
    if (mapped.status >= 500) console.error("[commerce.stock.movement] failed", { code: error.code });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
  const idempotent = Boolean(data && typeof data === "object" && "idempotent" in data && data.idempotent);
  return NextResponse.json({ movement: data }, { status: idempotent ? 200 : 201 });
}
