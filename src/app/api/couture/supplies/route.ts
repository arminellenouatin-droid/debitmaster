import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import type { CoutureSupplyCategory } from "@/lib/couture-supplies";

const validCategories: CoutureSupplyCategory[] = [
  "FABRIC",
  "THREAD",
  "BUTTON",
  "ZIPPER",
  "LINING",
  "ACCESSORY_HARDWARE",
  "PACKAGING",
  "OTHER",
];

const validUnits = ["METRE", "PIECE", "ROULEAU", "BOITE", "BOBINE", "PAQUET"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const category = searchParams.get("category");
    const siteId = searchParams.get("siteId");
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "supplies.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_supplies")
      .select(`
        *,
        stocks:couture_workshop_supply_stocks (id, site_id, quantity, updated_at)
      `)
      .eq("tenant_id", context.tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (category && validCategories.includes(category as CoutureSupplyCategory)) {
      query = query.eq("category", category);
    }

    const { data: supplies, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les fournitures." }, { status: 500 });
    }

    // Filtrer les stocks par siteId si spécifié
    let result = supplies ?? [];
    if (siteId) {
      result = result.map((item) => ({
        ...item,
        stocks: Array.isArray(item.stocks) ? item.stocks.filter((s: any) => s.site_id === siteId) : [],
      }));
    }

    return NextResponse.json({ supplies: result });
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

    assertCouturePermission(context, "supplies.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const category: CoutureSupplyCategory = validCategories.includes(body.category) ? body.category : "OTHER";
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const unit = typeof body.unit === "string" && validUnits.includes(body.unit.toUpperCase() as any)
      ? body.unit.toUpperCase()
      : "PIECE";
    const color = typeof body.color === "string" ? body.color.trim().slice(0, 60) : null;
    const reorderThreshold = Math.max(0, Number(body.reorderThreshold) || 5.0);
    const costPriceXof = Math.max(0, Math.floor(Number(body.costPriceXof) || 0));

    if (code.length < 2 || name.length < 2) {
      return NextResponse.json({ error: "Code et nom de fourniture requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: supply, error } = await admin
      .from("couture_supplies")
      .insert({
        tenant_id: context.tenantId,
        category,
        code,
        name,
        unit,
        color,
        reorder_threshold: reorderThreshold,
        cost_price_xof: costPriceXof,
      })
      .select()
      .single();

    if (error || !supply) {
      return NextResponse.json({ error: "Impossible de créer la fourniture." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.supplies.create",
      entityType: "couture_supplies",
      entityId: supply.id,
      metadata: { code, name, category },
    });

    return NextResponse.json({ supply }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
