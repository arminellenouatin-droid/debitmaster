import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action || "APPROVE"; // "APPROVE" or "MARK_SENT"

    const admin = createSupabaseAdminClient();

    const { data: order, error: orderErr } = await admin
      .from("purchase_orders")
      .select("id, status, order_number")
      .eq("id", orderId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Bon de commande introuvable." }, { status: 404 });
    }

    const now = new Date().toISOString();
    let updatedStatus = order.status;
    const updatePayload: Record<string, any> = { updated_at: now };

    if (action === "APPROVE") {
      updatedStatus = "APPROVED";
      updatePayload.status = "APPROVED";
      updatePayload.approved_by_user_id = context.user.id;
      updatePayload.approved_at = now;
    } else if (action === "MARK_SENT") {
      updatedStatus = "SENT";
      updatePayload.status = "SENT";
      updatePayload.sent_at = now;
    }

    const { data: updated, error: updateErr } = await admin
      .from("purchase_orders")
      .update(updatePayload)
      .eq("id", orderId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: "Impossible de mettre à jour le bon de commande." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: updated,
      message: `Bon de commande ${order.order_number} mis à jour (${updatedStatus}).`,
    });
  } catch (err) {
    console.error("[procurement/orders.approve] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
