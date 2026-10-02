import { NextResponse } from "next/server";
import { getCoutureContext } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { generateCoutureInventoryNumber } from "@/lib/couture-stocks";

const validInventoryTypes = ["BOUTIQUE_FINISHED_GOODS", "ATELIER_SUPPLIES"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const siteId = searchParams.get("siteId");
    const status = searchParams.get("status");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    const canView = context.permissions.has("inventory.view") || context.permissions.has("stock.view");
    if (!canView) {
      return NextResponse.json({ error: "Permission requise pour consulter les inventaires." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_inventory_sessions")
      .select(`
        *,
        site:couture_sites!site_id (id, name, site_type)
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (siteId) query = query.eq("site_id", siteId);
    if (status) query = query.eq("status", status);

    const { data: sessions, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les sessions d'inventaire." }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    const canStart = context.permissions.has("inventory.count") || context.permissions.has("inventory.validate");
    if (!canStart) {
      return NextResponse.json({ error: "Permission requise pour créer une session d'inventaire." }, { status: 403 });
    }
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const inventoryType = validInventoryTypes.includes(body.inventoryType)
      ? body.inventoryType
      : "BOUTIQUE_FINISHED_GOODS";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;

    if (!siteId) {
      return NextResponse.json({ error: "Site à inventorier requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Numéro séquentiel INV-YYYY-XXXXXX
    const currentYear = new Date().getFullYear();
    const { count } = await admin
      .from("couture_inventory_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId)
      .like("inventory_number", `INV-${currentYear}-%`);

    const sequence = (count ?? 0) + 1;
    const inventoryNumber = generateCoutureInventoryNumber(sequence, currentYear);

    const { data: session, error } = await admin
      .from("couture_inventory_sessions")
      .insert({
        tenant_id: context.tenantId,
        site_id: siteId,
        inventory_number: inventoryNumber,
        inventory_type: inventoryType,
        status: "IN_PROGRESS",
        notes,
        created_by: context.user.id,
      })
      .select()
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Impossible de créer la session d'inventaire." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.inventory.session_start",
      entityType: "couture_inventory_sessions",
      entityId: session.id,
      metadata: {
        inventoryNumber,
        siteId,
        inventoryType,
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
