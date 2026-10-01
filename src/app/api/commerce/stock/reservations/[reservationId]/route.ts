import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { commerceStockRpcError, isValidCommerceStockUuid, validateCommerceStockRelease } from "@/lib/commerce-stock";

export async function PATCH(request: Request, { params }: { params: Promise<{ reservationId: string }> }) {
  const parsed = await readCommerceJson(request, 4 * 1024);
  if (parsed.response) return parsed.response;
  const { reservationId } = await params;
  if (!isValidCommerceStockUuid(reservationId)) return NextResponse.json({ error: "Réservation invalide." }, { status: 400 });
  let input: ReturnType<typeof validateCommerceStockRelease>;
  try {
    input = validateCommerceStockRelease(parsed.body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Motif de libération invalide." }, { status: 400 });
  }
  const auth = await authorizeCommerceApi(request, {
    tenantId: input.tenantId,
    permission: "stock.manage",
    write: true,
    scope: "commerce:stock:reservation:release",
  });
  if ("response" in auth) return auth.response;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("release_commerce_stock_reservation", {
    p_tenant_id: input.tenantId,
    p_reservation_id: reservationId,
    p_actor_user_id: auth.context.user!.id,
    p_reason: input.reason,
  });
  if (error) {
    const mapped = commerceStockRpcError(error);
    if (mapped.status >= 500) console.error("[commerce.stock.reservation.release] failed", { code: error.code });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
  return NextResponse.json({ reservation: data });
}
