import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

const validCategories = ["SAC", "CHAUSSETTES", "LUNETTES", "MANCHETTES", "MONTRE", "AUTRE"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "catalog.view");

    const admin = createSupabaseAdminClient();
    const { data: accessories, error } = await admin
      .from("couture_accessories")
      .select("id,tenant_id,name,category,selling_price_xof,purchase_cost_xof,stock_alert_threshold,photo_url,is_active,created_at,updated_at")
      .eq("tenant_id", context.tenantId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les accessoires." }, { status: 500 });
    }

    return NextResponse.json({ accessories: accessories ?? [] });
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

    assertCouturePermission(context, "catalog.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const category = typeof body.category === "string" ? body.category.toUpperCase() : "AUTRE";
    const sellingPrice = Number(body.sellingPriceXof);
    const purchaseCost = body.purchaseCostXof !== undefined && body.purchaseCostXof !== null ? Number(body.purchaseCostXof) : null;
    const stockAlertThreshold = Number.isSafeInteger(body.stockAlertThreshold) ? Number(body.stockAlertThreshold) : 5;
    const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() : null;
    if (photoUrl && !photoUrl.startsWith("https://")) return NextResponse.json({ error: "URL de photo invalide." }, { status: 400 });

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Le nom de l’accessoire doit comporter entre 2 et 120 caractères." }, { status: 400 });
    }

    if (!validCategories.includes(category as (typeof validCategories)[number])) {
      return NextResponse.json({ error: "Catégorie d’accessoire invalide." }, { status: 400 });
    }

    if (!Number.isSafeInteger(sellingPrice) || sellingPrice < 0) {
      return NextResponse.json({ error: "Prix de vente valide (positif) requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: accessory, error } = await admin
      .from("couture_accessories")
      .insert({
        tenant_id: context.tenantId,
        name,
        category,
        selling_price_xof: sellingPrice,
        purchase_cost_xof: purchaseCost,
        stock_alert_threshold: stockAlertThreshold,
        photo_url: photoUrl,
        created_by: context.user.id,
      })
      .select("id,tenant_id,name,category,selling_price_xof,purchase_cost_xof,stock_alert_threshold,photo_url,is_active,created_at,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Impossible d’enregistrer l’accessoire." }, { status: 500 });
    }

    return NextResponse.json({ accessory }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    assertCouturePermission(context, "catalog.manage");
    if (context.accessMode !== "ACTIVE") return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    if (requestedTenantId && requestedTenantId !== context.tenantId) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Accessoire invalide." }, { status: 400 });
    }
    const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim().slice(0, 2048) || null : null;
    if (photoUrl && !photoUrl.startsWith("https://")) return NextResponse.json({ error: "URL de photo invalide." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: accessory, error } = await admin.from("couture_accessories")
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .select("id,tenant_id,name,category,selling_price_xof,purchase_cost_xof,stock_alert_threshold,photo_url,is_active,created_at,updated_at")
      .maybeSingle();
    if (error || !accessory) return NextResponse.json({ error: "Accessoire introuvable ou modification impossible." }, { status: 404 });
    return NextResponse.json({ accessory });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
