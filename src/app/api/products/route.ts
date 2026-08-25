// DebitManager catalogue API: produit validé côté serveur, catégorie et tenant contrôlés avant insertion.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { databaseDiagnostic, logDatabaseError } from "@/lib/database-error";

const productTypes = ["UNIT", "SERVICE", "MENU"] as const;
const stockFamilies = ["BEVERAGE", "KITCHEN"] as const;

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const canViewCatalog = can(context, "stock.view") || can(context, "products.manage") || can(context, "orders.create");
    if (!canViewCatalog) return NextResponse.json({ error: "Permission insuffisante pour consulter le catalogue." }, { status: 403 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const query = supabase.from("products").select("id,tenant_id,category_id,name,product_type,stock_family,unit,price,current_stock,alert_threshold,safety_threshold,image_url,created_at").is("deleted_at", null).order("name").limit(100);
    const { data, error } = await (tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", tenantIds));
    if (error) return NextResponse.json({ error: "Impossible de charger les produits." }, { status: 500 });
    const products = data ?? [];
    if (context.role === "SERVEUR") {
      return NextResponse.json({ products: products.map(({ id, category_id, name, product_type, unit, price, stock_family }) => ({ id, category_id, name, product_type, unit, price, stock_family })) });
    }
    return NextResponse.json({ products });
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
    const stockFamily = typeof body.stockFamily === "string" ? body.stockFamily : "BEVERAGE";
    const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim().slice(0, 40) : null;
    const price = Number(body.price);
    const currentStock = Number(body.currentStock ?? 0);
    const alertThreshold = Number(body.alertThreshold ?? 10);
    const safetyThreshold = Number(body.safetyThreshold ?? 5);
    if (!tenantId || name.length < 2 || !productTypes.includes(productType as (typeof productTypes)[number]) || !stockFamilies.includes(stockFamily as (typeof stockFamilies)[number]) || !Number.isInteger(price) || price < 0 || !Number.isInteger(currentStock) || currentStock < 0 || !Number.isInteger(alertThreshold) || alertThreshold < 0 || !Number.isInteger(safetyThreshold) || safetyThreshold < 0) return NextResponse.json({ error: "Nom, type et valeurs de stock valides requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "products.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer le catalogue." }, { status: 403 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    if (context.role === "MAGASINIER" && context.employeeId) {
      const { data: employee } = await supabase.from("employees").select("stock_scope").eq("id", context.employeeId).maybeSingle();
      if (employee?.stock_scope !== "BOTH" && employee?.stock_scope !== stockFamily) return NextResponse.json({ error: "Cette famille de stock est hors de votre périmètre." }, { status: 403 });
    }
    if (categoryId) { const { data: category } = await supabase.from("categories").select("id").eq("id", categoryId).eq("tenant_id", tenantId).maybeSingle(); if (!category) return NextResponse.json({ error: "Catégorie non autorisée." }, { status: 403 }); }
    const { data, error } = await supabase.from("products").insert({ tenant_id: tenantId, category_id: categoryId, name, product_type: productType, stock_family: stockFamily, unit, price, current_stock: currentStock, alert_threshold: alertThreshold, safety_threshold: safetyThreshold }).select("id,tenant_id,category_id,name,product_type,unit,price,current_stock,alert_threshold,safety_threshold,image_url,created_at").single();
    if (error) {
      logDatabaseError("products.POST", error);
      return NextResponse.json({ error: "Impossible de créer le produit.", diagnostic: databaseDiagnostic(error) }, { status: 400 });
    }
    return NextResponse.json({ product: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    const alertThreshold = Number(body.alertThreshold);
    const safetyThreshold = Number(body.safetyThreshold);
    if (!tenantId || !productId || !Number.isInteger(alertThreshold) || alertThreshold < 0 || !Number.isInteger(safetyThreshold) || safetyThreshold < 0 || safetyThreshold > alertThreshold) return NextResponse.json({ error: "Produit et seuils valides requis. Le seuil de sécurité doit être inférieur ou égal au seuil d’alerte." }, { status: 400 });
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "products.manage")) return NextResponse.json({ error: "Permission insuffisante pour paramétrer les alertes." }, { status: 403 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data: existingProduct } = await supabase.from("products").select("id,stock_family").eq("id", productId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle();
    if (!existingProduct) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    if (context.role === "MAGASINIER" && context.employeeId) {
      const { data: employee } = await supabase.from("employees").select("stock_scope").eq("id", context.employeeId).maybeSingle();
      if (employee?.stock_scope !== "BOTH" && employee?.stock_scope !== existingProduct.stock_family) return NextResponse.json({ error: "Ce produit est hors de votre périmètre de stock." }, { status: 403 });
    }
    const { data, error } = await supabase.from("products").update({ alert_threshold: alertThreshold, safety_threshold: safetyThreshold, updated_at: new Date().toISOString() }).eq("id", productId).eq("tenant_id", tenantId).is("deleted_at", null).select("id,tenant_id,name,current_stock,alert_threshold,safety_threshold").single();
    if (error) return NextResponse.json({ error: "Impossible de paramétrer les alertes." }, { status: 400 });
    return NextResponse.json({ product: data });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
