import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import type { CoutureSaleStatus } from "@/lib/couture-sales";

const allowedPatchStatuses: CoutureSaleStatus[] = ["CONFIRMED", "CANCELLED", "FULFILLED"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sales.view");

    const admin = createSupabaseAdminClient();
    const { data: sale, error: saleErr } = await admin
      .from("couture_sales")
      .select(`
        *,
        couture_customers (*),
        couture_sites (id, name, site_type, currency, country)
      `)
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .single();

    if (saleErr || !sale) {
      return NextResponse.json({ error: "Vente introuvable." }, { status: 404 });
    }

    const { data: lines } = await admin
      .from("couture_sale_lines")
      .select("*")
      .eq("sale_id", id)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: true });

    const { data: payments } = await admin
      .from("couture_sale_payments")
      .select("*")
      .eq("sale_id", id)
      .eq("tenant_id", context.tenantId)
      .order("paid_at", { ascending: true });

    return NextResponse.json({
      sale: {
        ...sale,
        lines: lines ?? [],
        payments: payments ?? [],
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sales.create");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.status === "string" && allowedPatchStatuses.includes(body.status.toUpperCase() as any)) {
      updates.status = body.status.toUpperCase();
    }
    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    }
    if (body.deliveryDeadline !== undefined) {
      updates.delivery_deadline =
        typeof body.deliveryDeadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.deliveryDeadline)
          ? body.deliveryDeadline
          : null;
    }

    const admin = createSupabaseAdminClient();
    const { data: updatedSale, error } = await admin
      .from("couture_sales")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error || !updatedSale) {
      return NextResponse.json({ error: "Vente introuvable ou mise à jour impossible." }, { status: 400 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.sale.update",
      entityType: "couture_sales",
      entityId: id,
      metadata: updates as Record<string, string | number | boolean | null>,
    });

    return NextResponse.json({ sale: updatedSale });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
