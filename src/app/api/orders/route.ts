// DebitManager orders API: commande et lignes vérifiées ensemble sur le même tenant avant insertion.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getOwnedTenantIds } from "@/lib/tenants";

type OrderLine = { productId: string; quantity: number };

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const query = supabase.from("orders").select("id,tenant_id,order_number,table_label,server_name,status,total_amount,currency,created_at,order_items(id,product_id,product_name,quantity,unit_price,total_price)").order("created_at", { ascending: false }).limit(50);
    const { data, error } = await (tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", tenantIds));
    if (error) return NextResponse.json({ error: "Impossible de charger les commandes." }, { status: 500 });
    return NextResponse.json({ orders: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const tableLabel = typeof body.tableLabel === "string" ? body.tableLabel.trim().slice(0, 80) : null;
    const lines = Array.isArray(body.lines) ? body.lines as OrderLine[] : [];
    if (!tenantId || !lines.length || lines.length > 50) return NextResponse.json({ error: "Établissement et au moins une ligne de commande requis." }, { status: 400 });
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const normalizedLines = lines.map((line) => ({ productId: typeof line.productId === "string" ? line.productId : "", quantity: Number(line.quantity) })).filter((line) => line.productId && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 999);
    if (normalizedLines.length !== lines.length) return NextResponse.json({ error: "Chaque ligne doit contenir un produit et une quantité valide." }, { status: 400 });
    const ids = [...new Set(normalizedLines.map((line) => line.productId))];
    const { data: products, error: productError } = await supabase.from("products").select("id,name,price,tenant_id,deleted_at").in("id", ids).eq("tenant_id", tenantId).is("deleted_at", null).limit(50);
    if (productError || !products || products.length !== ids.length) return NextResponse.json({ error: "Un ou plusieurs produits ne sont pas disponibles dans cet établissement." }, { status: 400 });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderLines = normalizedLines.map((line) => { const product = productMap.get(line.productId)!; return { tenant_id: tenantId, product_id: product.id, product_name: product.name, quantity: line.quantity, unit_price: product.price, total_price: product.price * line.quantity }; });
    const totalAmount = orderLines.reduce((total, line) => total + line.total_price, 0);
    const orderNumber = `DM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: order, error: orderError } = await supabase.from("orders").insert({ tenant_id: tenantId, order_number: orderNumber, table_label: tableLabel, server_name: user.user_metadata?.first_name ?? null, total_amount: totalAmount, currency: "XOF" }).select("id,tenant_id,order_number,table_label,server_name,status,total_amount,currency,created_at").single();
    if (orderError || !order) return NextResponse.json({ error: "Impossible de créer la commande." }, { status: 400 });
    const { data: insertedLines, error: linesError } = await supabase.from("order_items").insert(orderLines.map((line) => ({ ...line, order_id: order.id }))).select("id,product_id,product_name,quantity,unit_price,total_price");
    if (linesError) { await supabase.from("orders").delete().eq("id", order.id).eq("tenant_id", tenantId); return NextResponse.json({ error: "Impossible d’enregistrer les lignes de commande." }, { status: 400 }); }
    return NextResponse.json({ order: { ...order, order_items: insertedLines ?? [] } }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
