// DebitManager purchases API: chaque entrée garde sa facture et son prix d’achat, sans écraser l’historique.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les achats." }, { status: 403 });
    if (tenantId && !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    let query = context.supabase.from("stock_purchases").select("id,tenant_id,store_id,product_id,invoice_number,purchase_unit_price,quantity,purchased_at,entered_by,created_at,inventory_stores(name),products(name,unit,stock_family)").order("purchased_at", { ascending: false }).limit(100);
    query = tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", context.tenantIds);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger l’historique des achats." }, { status: 500 });
    return NextResponse.json({ purchases: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const storeId = typeof body.storeId === "string" ? body.storeId : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    const quantity = Number(body.quantity);
    const purchaseUnitPrice = Number(body.purchaseUnitPrice);
    const invoiceNumber = typeof body.invoiceNumber === "string" ? body.invoiceNumber.trim().slice(0, 120) : null;
    if (!tenantId || !storeId || !productId || !Number.isInteger(quantity) || quantity <= 0 || !Number.isInteger(purchaseUnitPrice) || purchaseUnitPrice < 0) return NextResponse.json({ error: "Magasin, produit, quantité et prix d’achat valides requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.receive")) return NextResponse.json({ error: "Permission insuffisante pour entrer un stock." }, { status: 403 });
    if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await context.supabase.rpc("record_stock_purchase", { p_tenant_id: tenantId, p_store_id: storeId, p_product_id: productId, p_quantity: quantity, p_purchase_unit_price: purchaseUnitPrice, p_invoice_number: invoiceNumber });
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer l’entrée de stock." }, { status: 400 });
    return NextResponse.json({ purchase: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
