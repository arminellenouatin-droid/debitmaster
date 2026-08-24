// DebitManager catalogue API: produit validé côté serveur, catégorie et tenant contrôlés avant insertion.
import { NextResponse } from "next/server";
import { getOwnedTenantIds } from "@/lib/tenants";

const productTypes = ["UNIT", "SERVICE", "MENU"] as const;

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const query = supabase.from("products").select("id,tenant_id,category_id,name,product_type,unit,price,current_stock,alert_threshold,safety_threshold,image_url,created_at").is("deleted_at", null).order("name").limit(100);
    const { data, error } = await (tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", tenantIds));
    if (error) return NextResponse.json({ error: "Impossible de charger les produits." }, { status: 500 });
    return NextResponse.json({ products: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const categoryId = typeof body.categoryId === "string" && body.categoryId ? body.categoryId : null;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const productType = typeof body.productType === "string" ? body.productType : "";
    const price = Number(body.price);
    const currentStock = Number(body.currentStock ?? 0);
    const alertThreshold = Number(body.alertThreshold ?? 10);
    const safetyThreshold = Number(body.safetyThreshold ?? 5);
    if (!tenantId || name.length < 2 || !productTypes.includes(productType as (typeof productTypes)[number]) || !Number.isInteger(price) || price < 0 || !Number.isInteger(currentStock) || currentStock < 0 || !Number.isInteger(alertThreshold) || alertThreshold < 0 || !Number.isInteger(safetyThreshold) || safetyThreshold < 0) return NextResponse.json({ error: "Nom, type et valeurs de stock valides requis." }, { status: 400 });
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    if (categoryId) { const { data: category } = await supabase.from("categories").select("id").eq("id", categoryId).eq("tenant_id", tenantId).maybeSingle(); if (!category) return NextResponse.json({ error: "Catégorie non autorisée." }, { status: 403 }); }
    const { data, error } = await supabase.from("products").insert({ tenant_id: tenantId, category_id: categoryId, name, product_type: productType, price, current_stock: currentStock, alert_threshold: alertThreshold, safety_threshold: safetyThreshold }).select("id,tenant_id,category_id,name,product_type,unit,price,current_stock,alert_threshold,safety_threshold,image_url,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible de créer le produit." }, { status: 400 });
    return NextResponse.json({ product: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
