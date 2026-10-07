import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculateParetoAbcClassification } from "@/lib/couture-analytics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const siteId = searchParams.get("siteId");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "reports.view");

    const admin = createSupabaseAdminClient();

    // 1. Récupérer les lignes de vente
    const query = admin
      .from("couture_sale_lines")
      .select(`
        id,
        line_type,
        model_id,
        accessory_id,
        description,
        total_price,
        sale:couture_sales!sale_id (id, site_id, payment_status)
      `)
      .eq("tenant_id", context.tenantId);

    const { data: lines, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Impossible de charger les données de vente." }, { status: 500 });
    }

    // Filtrer par site si demandé et exclure les ventes annulées
    const validLines = (lines ?? []).filter((l) => {
      const sale = Array.isArray(l.sale) ? l.sale[0] : l.sale;
      if (!sale) return false;
      if (siteId && sale.site_id !== siteId) return false;
      return true;
    });

    // 2. Agréger par article / modèle
    const productAggregation = new Map<string, { id: string; label: string; revenueXof: number }>();

    for (const l of validLines) {
      const key = l.model_id || l.accessory_id || l.description || "Article";
      const label = l.description || (l.model_id ? `Modèle ${l.model_id}` : `Accessoire ${l.accessory_id}`);
      const rev = Number(l.total_price) || 0;

      const current = productAggregation.get(key) || {
        id: key,
        label,
        revenueXof: 0,
      };

      current.revenueXof += rev;
      productAggregation.set(key, current);
    }

    const itemsInput = Array.from(productAggregation.values());
    const paretoReport = calculateParetoAbcClassification(itemsInput);

    return NextResponse.json({
      report: paretoReport,
      siteId: siteId || "ALL_SITES",
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
