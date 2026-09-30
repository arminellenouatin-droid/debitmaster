import { NextResponse } from "next/server";
import { authorizeCommerceApi } from "@/lib/commerce-api";
import { canCommerce } from "@/lib/commerce-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ productId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const costKeys = new Set(["purchase_price_xof", "weighted_avg_cost_xof"]);

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { productId } = await params;
    if (!uuidPattern.test(productId)) return NextResponse.json({ error: "Produit invalide." }, { status: 400 });
    const access = await authorizeCommerceApi(request, { permission: "catalog.view", scope: "catalog:price-history:read", limit: 60 });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("commerce_product_price_history")
      .select("id,changed_by,before_values,after_values,created_at")
      .eq("tenant_id", access.context.tenantId).eq("product_id", productId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: "Impossible de charger l’historique tarifaire." }, { status: 500 });
    const mayViewCosts = access.context.isOwner || canCommerce(access.context, "costs.view");
    const history = (data ?? []).map((entry) => {
      const before = entry.before_values && typeof entry.before_values === "object" ? { ...entry.before_values } as Record<string, unknown> : {};
      const after = entry.after_values && typeof entry.after_values === "object" ? { ...entry.after_values } as Record<string, unknown> : {};
      if (!mayViewCosts) for (const key of costKeys) { delete before[key]; delete after[key]; }
      return { id: entry.id, actorUserId: entry.changed_by, before, after, createdAt: entry.created_at };
    });
    return NextResponse.json({ history, mayViewCosts });
  } catch {
    return NextResponse.json({ error: "Impossible de charger l’historique tarifaire." }, { status: 500 });
  }
}
