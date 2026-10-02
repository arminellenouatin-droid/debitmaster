import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const siteId = searchParams.get("siteId");
    const productType = searchParams.get("productType");
    const lowStockOnly = searchParams.get("lowStock") === "true";

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "stock.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_boutique_stocks")
      .select(`
        *,
        site:couture_sites!site_id (id, name, site_type, city),
        model:couture_models!model_id (id, name, reference_code),
        range:couture_ranges!range_id (id, name),
        size:couture_sizes!size_id (id, label),
        color:couture_colors!color_id (id, name, hex_code),
        accessory:couture_accessories!accessory_id (id, name, reference_code)
      `)
      .eq("tenant_id", context.tenantId)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (siteId) query = query.eq("site_id", siteId);
    if (productType && ["CLOTHING", "ACCESSORY"].includes(productType)) {
      query = query.eq("product_type", productType);
    }

    const { data: stocks, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les stocks de boutique." }, { status: 500 });
    }

    let filtered = stocks ?? [];
    if (lowStockOnly) {
      filtered = filtered.filter((s: any) => s.quantity <= (s.min_threshold ?? 2));
    }

    return NextResponse.json({ stocks: filtered });
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

    assertCouturePermission(context, "stock.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const productType = ["CLOTHING", "ACCESSORY"].includes(body.productType) ? body.productType : "CLOTHING";
    const quantity = Math.max(0, Math.round(Number(body.quantity) || 0));
    const minThreshold = Math.max(0, Math.round(Number(body.minThreshold) || 2));

    if (!siteId) {
      return NextResponse.json({ error: "Site boutique obligatoire." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: stockItem, error: insertErr } = await admin
      .from("couture_boutique_stocks")
      .insert({
        tenant_id: context.tenantId,
        site_id: siteId,
        product_type: productType,
        model_id: body.modelId || null,
        range_id: body.rangeId || null,
        size_id: body.sizeId || null,
        color_id: body.colorId || null,
        accessory_id: body.accessoryId || null,
        quantity,
        min_threshold: minThreshold,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr || !stockItem) {
      return NextResponse.json({ error: "Impossible de créer l'article de stock boutique." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.stock.boutique_item_create",
      entityType: "couture_boutique_stocks",
      entityId: stockItem.id,
      metadata: { siteId, productType, quantity },
    });

    return NextResponse.json({ stock: stockItem }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
