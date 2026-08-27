// DebitManager Power: demandes du magasin comptoir, validation avec réservation, livraison après confirmation.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Line = { productId: string; quantity: number };
const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function weightedCosts(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, productIds: string[]) {
  const { data } = await admin.from("stock_purchases").select("product_id,purchase_unit_price,quantity").eq("tenant_id", tenantId).in("product_id", productIds).limit(500);
  const totals = new Map<string, { amount: number; quantity: number }>();
  for (const row of data ?? []) { const current = totals.get(row.product_id) ?? { amount: 0, quantity: 0 }; current.amount += Number(row.purchase_unit_price) * Number(row.quantity); current.quantity += Number(row.quantity); totals.set(row.product_id, current); }
  return new Map([...totals].map(([id, value]) => [id, value.quantity ? Math.round(value.amount / value.quantity) : 0]));
}

async function stores(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string) {
  const { data } = await admin.from("inventory_stores").select("id,name,store_type,stock_family,is_active").eq("tenant_id", tenantId).eq("is_active", true).limit(100);
  const list = data ?? [];
  return { central: list.find((item) => item.store_type !== "COUNTER" && item.stock_family === "BEVERAGE"), counter: list.find((item) => item.store_type === "COUNTER" && item.stock_family === "BEVERAGE") };
}

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return jsonError("Authentification requise.", 401);
    if (!context.tenantIds.includes(tenantId) || !can(context, "stock.view")) return jsonError("Établissement ou permission non autorisé.", 403);
    const admin = createSupabaseAdminClient();
    const { data: requests, error } = await admin.from("counter_replenishment_requests").select("id,tenant_id,counter_store_id,central_store_id,requested_by,status,note,validated_by,validated_at,delivered_by,delivered_at,created_at,updated_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100);
    if (error) return jsonError("Impossible de charger les demandes.", 500);
    const ids = (requests ?? []).map((item) => item.id);
    const { data: items } = ids.length ? await admin.from("counter_replenishment_request_items").select("id,request_id,product_id,requested_quantity,unit_cost_snapshot,products(id,name,unit,stock_family,price)").in("request_id", ids).limit(500) : { data: [] };
    return NextResponse.json({ requests: (requests ?? []).map((item) => ({ ...item, items: (items ?? []).filter((line) => line.request_id === item.id) })) });
  } catch { return jsonError("Service temporairement indisponible.", 500); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 240) : null;
    const lines: Line[] = Array.isArray(body.items) ? body.items.filter((item: unknown): item is Line => Boolean(item && typeof item === "object" && typeof (item as Line).productId === "string" && Number.isInteger((item as Line).quantity) && (item as Line).quantity > 0)) : [];
    if (!tenantId || !lines.length) return jsonError("Établissement et produits demandés requis.");
    const context = await getAuthorizationContext();
    if (!context.user) return jsonError("Authentification requise.", 401);
    if (context.role !== "GERANT" || !can(context, "stock.view") || !context.tenantIds.includes(tenantId)) return jsonError("Seul le Gérant autorisé peut créer une demande comptoir.", 403);
    const admin = createSupabaseAdminClient();
    const { central, counter } = await stores(admin, tenantId);
    if (!central || !counter) return jsonError("Les magasins central boissons et comptoir doivent être configurés.", 400);
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const { data: products, error: productsError } = await admin.from("products").select("id,name,unit,stock_family,price,alert_threshold").eq("tenant_id", tenantId).in("id", productIds).is("deleted_at", null).limit(100);
    if (productsError || !products || products.length !== productIds.length || products.some((product) => product.stock_family !== "BEVERAGE")) return jsonError("Les demandes du comptoir concernent uniquement les boissons.");
    const costs = await weightedCosts(admin, tenantId, productIds);
    const { data: created, error: createError } = await admin.from("counter_replenishment_requests").insert({ tenant_id: tenantId, counter_store_id: counter.id, central_store_id: central.id, requested_by: context.user.id, note }).select("id,tenant_id,counter_store_id,central_store_id,requested_by,status,note,created_at,updated_at").single();
    if (createError || !created) return jsonError("Impossible d’enregistrer la demande.");
    const { error: itemsError } = await admin.from("counter_replenishment_request_items").insert(lines.map((line) => ({ request_id: created.id, tenant_id: tenantId, product_id: line.productId, requested_quantity: line.quantity, unit_cost_snapshot: costs.get(line.productId) ?? 0 })));
    if (itemsError) { await admin.from("counter_replenishment_requests").delete().eq("id", created.id); return jsonError("Impossible d’enregistrer les lignes de la demande."); }
    return NextResponse.json({ request: created }, { status: 201 });
  } catch { return jsonError("Requête invalide."); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const action = body.action === "validate" || body.action === "deliver" || body.action === "edit" ? body.action : "";
    if (!tenantId || !requestId || !action) return jsonError("Demande et action valides requises.");
    const context = await getAuthorizationContext();
    if (!context.user || !context.tenantIds.includes(tenantId)) return jsonError("Établissement non autorisé.", 403);
    const admin = createSupabaseAdminClient();
    const { data: current } = await admin.from("counter_replenishment_requests").select("id,status,tenant_id").eq("id", requestId).eq("tenant_id", tenantId).maybeSingle();
    if (!current) return jsonError("Demande introuvable.", 404);
    if (action === "validate") {
      if (context.role !== "SUPERVISEUR" || !can(context, "stock.audit")) return jsonError("Seul le Superviseur autorisé peut valider cette demande.", 403);
      const { data, error } = await context.supabase.rpc("validate_counter_replenishment", { p_request_id: requestId });
      if (error) return jsonError(error.message.includes("INSUFFICIENT") ? "Stock central insuffisant ou déjà réservé." : "Impossible de valider la demande.", 409);
      return NextResponse.json({ request: data });
    }
    if (action === "deliver") {
      if (context.role !== "GERANT" || !can(context, "stock.accept_counter")) return jsonError("Seul le Gérant autorisé peut confirmer la livraison.", 403);
      const { data, error } = await context.supabase.rpc("deliver_counter_replenishment", { p_request_id: requestId });
      if (error) return jsonError(error.message.includes("SOURCE_STOCK") ? "Le stock central a changé ; la livraison doit être vérifiée." : "Impossible de confirmer la livraison.", 409);
      return NextResponse.json({ request: data });
    }
    if (context.role !== "SUPERVISEUR" || !can(context, "stock.receive")) return jsonError("Seul le Superviseur autorisé peut modifier cette demande.", 403);
    if (current.status !== "REQUESTED") return jsonError("Une demande validée ne peut plus être modifiée.", 409);
    const lines: Line[] = Array.isArray(body.items) ? body.items.filter((item: unknown): item is Line => Boolean(item && typeof item === "object" && typeof (item as Line).productId === "string" && Number.isInteger((item as Line).quantity) && (item as Line).quantity > 0)) : [];
    if (!lines.length) return jsonError("La demande doit conserver au moins un produit.");
    const costs = await weightedCosts(admin, tenantId, [...new Set(lines.map((line) => line.productId))]);
    await admin.from("counter_replenishment_request_items").delete().eq("request_id", requestId);
    const { error } = await admin.from("counter_replenishment_request_items").insert(lines.map((line) => ({ request_id: requestId, tenant_id: tenantId, product_id: line.productId, requested_quantity: line.quantity, unit_cost_snapshot: costs.get(line.productId) ?? 0 })));
    if (error) return jsonError("Impossible de modifier les lignes de la demande.");
    return NextResponse.json({ ok: true });
  } catch { return jsonError("Requête invalide."); }
}
