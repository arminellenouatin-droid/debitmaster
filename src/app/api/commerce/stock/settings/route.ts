import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { commerceStockRpcError, validateCommerceStockSettings } from "@/lib/commerce-stock";

export async function GET(request: Request) {
  const auth = await authorizeCommerceApi(request, { permission: "stock.view", scope: "commerce:stock:settings:view" });
  if ("response" in auth) return auth.response;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("commerce_stock_settings")
    .select("tenant_id,allow_negative_stock,reservation_duration_minutes,updated_at")
    .eq("tenant_id", auth.context.tenantId!)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Impossible de charger les paramètres Stock." }, { status: 500 });
  return NextResponse.json({ settings: data ?? { tenant_id: auth.context.tenantId, allow_negative_stock: false, reservation_duration_minutes: 1440 } });
}

export async function PATCH(request: Request) {
  const parsed = await readCommerceJson(request, 4 * 1024);
  if (parsed.response) return parsed.response;
  let settings: ReturnType<typeof validateCommerceStockSettings>;
  try {
    settings = validateCommerceStockSettings(parsed.body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Paramètres Stock invalides." }, { status: 400 });
  }
  const auth = await authorizeCommerceApi(request, {
    tenantId: settings.tenantId,
    permission: "stock.manage",
    ownerOnly: true,
    write: true,
    scope: "commerce:stock:settings:update",
  });
  if ("response" in auth) return auth.response;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("update_commerce_stock_settings", {
    p_tenant_id: settings.tenantId,
    p_allow_negative_stock: settings.allowNegativeStock,
    p_reservation_duration_minutes: settings.reservationDurationMinutes,
    p_actor_user_id: auth.context.user!.id,
  });
  if (error) {
    const mapped = commerceStockRpcError(error);
    if (mapped.status >= 500) console.error("[commerce.stock.settings] failed", { code: error.code });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
  return NextResponse.json({ settings: data });
}
