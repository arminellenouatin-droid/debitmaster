/* DebitManager Power owner stock API: real inventory positions and movements, isolated by active tenant. */
import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { can } from "@/lib/authorization";

const dayMs = 24 * 60 * 60 * 1000;
function period(url: URL) { const range = url.searchParams.get("range") ?? "30d"; const end = url.searchParams.get("end") ? new Date(`${url.searchParams.get("end")}T23:59:59.999Z`) : new Date(); let start = new Date(end.getTime() - 29 * dayMs); if (range === "today") start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())); if (range === "7d") start = new Date(end.getTime() - 6 * dayMs); if (range === "90d") start = new Date(end.getTime() - 89 * dayMs); if (range === "custom" && url.searchParams.get("start")) start = new Date(`${url.searchParams.get("start")}T00:00:00.000Z`); if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return { start: new Date(Date.now() - 29 * dayMs), end: new Date() }; return { start, end }; }
function familyLabel(family: string | null) { return String(family).toUpperCase() === "KITCHEN" ? "Cuisine" : "Boissons"; }

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || !context.company) return NextResponse.json({ error: "Aucun établissement actif." }, { status: 404 });
    if (context.role !== "ADMINISTRATEUR" || context.employeeId !== null || context.company.activity_type !== "POWER" || !can(context, "stock.view")) return NextResponse.json({ error: "Accès réservé au propriétaire Power." }, { status: 403 });
    const url = new URL(request.url); const { start, end } = period(url); const tenantId = context.tenantId;
    const [productsResult, storesResult, movementsResult, purchasesResult, controlsResult] = await Promise.all([
      context.supabase.from("products").select("id,name,product_type,unit,stock_family,current_stock,alert_threshold,safety_threshold").eq("tenant_id", tenantId).is("deleted_at", null).order("name").limit(1000),
      context.supabase.from("inventory_stores").select("id,name,store_type,is_active,store_inventory(id,product_id,quantity,reserved_quantity,products(id,name,unit,stock_family))").eq("tenant_id", tenantId).eq("is_active", true).order("name").limit(100),
      context.supabase.from("stock_movements").select("id,product_id,movement_type,quantity,destination,created_at,products(name,unit,stock_family)").eq("tenant_id", tenantId).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()).order("created_at", { ascending: false }).limit(4000),
      context.supabase.from("stock_purchases").select("id,product_id,quantity,purchase_unit_price,purchased_at,products(name,unit,stock_family)").eq("tenant_id", tenantId).gte("purchased_at", start.toISOString()).lte("purchased_at", end.toISOString()).order("purchased_at", { ascending: false }).limit(4000),
      context.supabase.from("daily_stock_controls").select("id,business_date,actual_sales_xof,closing_stock_snapshot,status,notes,validated_at,created_at").eq("tenant_id", tenantId).order("business_date", { ascending: false }).limit(60),
    ]);
    if (productsResult.error || storesResult.error || movementsResult.error || purchasesResult.error || controlsResult.error) return NextResponse.json({ error: "Impossible de charger la situation des stocks." }, { status: 500 });
    const products = productsResult.data ?? []; const purchases = purchasesResult.data ?? [];
    const costs = new Map<string, { quantity: number; value: number }>();
    const allPurchases = await context.supabase.from("stock_purchases").select("product_id,quantity,purchase_unit_price").eq("tenant_id", tenantId).limit(10000); if (allPurchases.error) return NextResponse.json({ error: "Impossible de valoriser le stock." }, { status: 500 });
    for (const purchase of allPurchases.data ?? []) { const current = costs.get(purchase.product_id) ?? { quantity: 0, value: 0 }; current.quantity += Number(purchase.quantity ?? 0); current.value += Number(purchase.quantity ?? 0) * Number(purchase.purchase_unit_price ?? 0); costs.set(purchase.product_id, current); }
    const inventory = products.map((product) => { const cost = costs.get(product.id); const weightedCost = cost?.quantity ? Math.round(cost.value / cost.quantity) : 0; const movements = (movementsResult.data ?? []).filter((item) => item.product_id === product.id); const purchased = purchases.filter((item) => item.product_id === product.id).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0); const sold = movements.filter((item) => item.movement_type === "OUT_SALE").reduce((sum, item) => sum + Math.abs(Number(item.quantity ?? 0)), 0); return { ...product, family_label: familyLabel(product.stock_family), weighted_purchase_price: weightedCost, stock_value: Number(product.current_stock ?? 0) * weightedCost, purchased_period: purchased, sold_period: sold }; });
    const stores = (storesResult.data ?? []).map((store) => ({ ...store, family_label: store.store_type === "COUNTER" ? "Boissons · Magasin comptoir" : "Boissons · Magasin principal / Cuisine", total_units: (store.store_inventory ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0), total_value: (store.store_inventory ?? []).reduce((sum, item) => { const cost = costs.get(item.product_id); return sum + Number(item.quantity ?? 0) * (cost?.quantity ? Math.round(cost.value / cost.quantity) : 0); }, 0) }));
    const totals = { units: inventory.reduce((sum, item) => sum + Number(item.current_stock ?? 0), 0), value: inventory.reduce((sum, item) => sum + Number(item.stock_value ?? 0), 0), purchased: inventory.reduce((sum, item) => sum + Number(item.purchased_period ?? 0), 0), sold: inventory.reduce((sum, item) => sum + Number(item.sold_period ?? 0), 0), low: inventory.filter((item) => Number(item.current_stock ?? 0) <= Number(item.alert_threshold ?? 0)).length, critical: inventory.filter((item) => Number(item.current_stock ?? 0) <= Number(item.safety_threshold ?? 0)).length };
    return NextResponse.json({ period: { range: url.searchParams.get("range") ?? "30d", start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }, totals, inventory, stores, movements: movementsResult.data ?? [], purchases, controls: controlsResult.data ?? [], filters: { families: ["Boissons", "Cuisine"], productTypes: [...new Set(products.map((item) => item.product_type).filter(Boolean))] } });
  } catch { return NextResponse.json({ error: "Service de supervision stock temporairement indisponible." }, { status: 500 }); }
}
