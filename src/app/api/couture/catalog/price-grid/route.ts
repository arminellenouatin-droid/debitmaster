import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { computeChildPrice } from "@/lib/couture-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

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
    const { data: grid, error } = await admin
      .from("couture_price_grid")
      .select("id,tenant_id,model_id,range_id,price_adult_xof,price_child_xof,couture_models(id,name,gender),couture_ranges(id,name,rank)")
      .eq("tenant_id", context.tenantId);

    if (error) {
      return NextResponse.json({ error: "Impossible de charger la grille tarifaire." }, { status: 500 });
    }

    return NextResponse.json({ priceGrid: grid ?? [] });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
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

    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) {
      return NextResponse.json({ error: "Au moins une ligne de tarif est requise." }, { status: 400 });
    }

    const validPayloads = [];
    for (const item of entries) {
      const modelId = typeof item.modelId === "string" ? item.modelId : "";
      const rangeId = typeof item.rangeId === "string" ? item.rangeId : "";
      const priceAdult = Number(item.priceAdultXof);
      const priceChild = item.priceChildXof !== undefined ? Number(item.priceChildXof) : computeChildPrice(priceAdult);

      if (!modelId || !rangeId || !Number.isSafeInteger(priceAdult) || priceAdult < 0 || !Number.isSafeInteger(priceChild) || priceChild < 0) {
        return NextResponse.json({ error: "Identifiant modèle, gamme et prix valides (positifs) requis." }, { status: 400 });
      }

      validPayloads.push({
        tenant_id: context.tenantId,
        model_id: modelId,
        range_id: rangeId,
        price_adult_xof: priceAdult,
        price_child_xof: priceChild,
        created_by: context.user.id,
        updated_at: new Date().toISOString(),
      });
    }

    const admin = createSupabaseAdminClient();
    const { data: updatedGrid, error } = await admin
      .from("couture_price_grid")
      .upsert(validPayloads, { onConflict: "tenant_id,model_id,range_id" })
      .select("id,tenant_id,model_id,range_id,price_adult_xof,price_child_xof");

    if (error) {
      return NextResponse.json({ error: "Impossible d’enregistrer la grille tarifaire." }, { status: 500 });
    }

    return NextResponse.json({ priceGrid: updatedGrid ?? [] });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
