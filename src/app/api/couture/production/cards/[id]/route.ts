import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import type { CouturePriority } from "@/lib/couture-production";

const validPriorities: CouturePriority[] = ["NORMAL", "URGENT", "VERY_URGENT"];

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

    assertCouturePermission(context, "production.view");

    const admin = createSupabaseAdminClient();
    const { data: card, error: cardErr } = await admin
      .from("couture_production_cards")
      .select(`
        *,
        couture_customers (*),
        workshop:couture_sites!workshop_site_id (id, name, site_type),
        boutique:couture_sites!source_boutique_site_id (id, name, site_type)
      `)
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .single();

    if (cardErr || !card) {
      return NextResponse.json({ error: "Fiche de fabrication introuvable." }, { status: 404 });
    }

    const { data: steps } = await admin
      .from("couture_production_steps")
      .select(`
        *,
        assigned_employee:couture_employees!assigned_employee_id (id, full_name, crafts, phone)
      `)
      .eq("card_id", id)
      .eq("tenant_id", context.tenantId)
      .order("step_order", { ascending: true });

    const { data: qualityControls } = await admin
      .from("couture_quality_controls")
      .select("*")
      .eq("card_id", id)
      .eq("tenant_id", context.tenantId)
      .order("inspected_at", { ascending: true });

    return NextResponse.json({
      card: {
        ...card,
        steps: steps ?? [],
        qualityControls: qualityControls ?? [],
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

    assertCouturePermission(context, "production.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.priority === "string" && validPriorities.includes(body.priority as CouturePriority)) {
      updates.priority = body.priority;
    }
    if (body.targetDeliveryDate !== undefined) {
      updates.target_delivery_date =
        typeof body.targetDeliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.targetDeliveryDate)
          ? body.targetDeliveryDate
          : null;
    }
    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    }

    const admin = createSupabaseAdminClient();
    const { data: updatedCard, error } = await admin
      .from("couture_production_cards")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error || !updatedCard) {
      return NextResponse.json({ error: "Fiche introuvable ou mise à jour impossible." }, { status: 400 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.production.card_update",
      entityType: "couture_production_cards",
      entityId: id,
      metadata: updates as Record<string, string | number | boolean | null>,
    });

    return NextResponse.json({ card: updatedCard });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
