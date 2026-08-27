// DebitManager catalogue API: produit validé côté serveur, catégorie et tenant contrôlés avant insertion.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { databaseDiagnostic, logDatabaseError } from "@/lib/database-error";

const productTypes = ["UNIT", "SERVICE", "MENU"] as const;
const stockFamilies = ["BEVERAGE", "KITCHEN"] as const;
const normalizeLabel = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : null;

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const canViewCatalog = can(context, "stock.view") || can(context, "products.manage") || can(context, "orders.create");
    if (!canViewCatalog) return NextResponse.json({ error: "Permission insuffisante pour consulter le catalogue." }, { status: 403 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const query = supabase.from("products").select("id,tenant_id,category_id,name,product_type,stock_family,unit,price,current_stock,alert_threshold,safety_threshold,image_url,packaging_label,created_at").is("deleted_at", null).order("name").limit(100);
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
    const packagingLabel = normalizeLabel(body.packagingLabel);
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
    const { data, error } = await supabase.from("products").insert({ tenant_id: tenantId, category_id: categoryId, name, product_type: productType, stock_family: stockFamily, unit, price, packaging_label: packagingLabel, current_stock: currentStock, alert_threshold: alertThreshold, safety_threshold: safetyThreshold }).select("id,tenant_id,category_id,name,product_type,stock_family,unit,price,packaging_label,current_stock,alert_threshold,safety_threshold,image_url,created_at").single();
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
    const alertThreshold = body.alertThreshold === undefined ? undefined : Number(body.alertThreshold);
    const safetyThreshold = body.safetyThreshold === undefined ? undefined : Number(body.safetyThreshold);
    const categoryId = body.categoryId === undefined ? undefined : (typeof body.categoryId === "string" && body.categoryId ? body.categoryId : null);
    const name = body.name === undefined ? undefined : (typeof body.name === "string" ? body.name.trim() : "");
    const price = body.price === undefined ? undefined : Number(body.price);
    const packagingLabel = body.packagingLabel === undefined ? undefined : normalizeLabel(body.packagingLabel);
    const stockFamily = body.stockFamily === undefined ? undefined : (typeof body.stockFamily === "string" ? body.stockFamily : "");
    if (!tenantId || !productId || (alertThreshold !== undefined && (!Number.isInteger(alertThreshold) || alertThreshold < 0)) || (safetyThreshold !== undefined && (!Number.isInteger(safetyThreshold) || safetyThreshold < 0)) || (alertThreshold !== undefined && safetyThreshold !== undefined && safetyThreshold > alertThreshold) || (price !== undefined && (!Number.isInteger(price) || price < 0)) || (name !== undefined && name.length < 2) || (stockFamily !== undefined && !stockFamilies.includes(stockFamily as (typeof stockFamilies)[number]))) return NextResponse.json({ error: "Produit et seuils valides requis. Le seuil de sécurité doit être inférieur ou égal au seuil d’alerte." }, { status: 400 });
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
    if (categoryId !== undefined) { const { data: category } = categoryId ? await supabase.from("categories").select("id").eq("id", categoryId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle() : { data: null }; if (categoryId && !category) return NextResponse.json({ error: "Catégorie non autorisée." }, { status: 403 }); }
    const patch = { ...(name !== undefined ? { name } : {}), ...(categoryId !== undefined ? { category_id: categoryId } : {}), ...(price !== undefined ? { price } : {}), ...(stockFamily !== undefined ? { stock_family: stockFamily } : {}), ...(packagingLabel !== undefined ? { packaging_label: packagingLabel } : {}), ...(alertThreshold !== undefined ? { alert_threshold: alertThreshold } : {}), ...(safetyThreshold !== undefined ? { safety_threshold: safetyThreshold } : {}), updated_at: new Date().toISOString() };
    const { error } = await supabase.from("products").update(patch).eq("id", productId).eq("tenant_id", tenantId).is("deleted_at", null);
    if (error) {
      logDatabaseError("products.PATCH", error);
      const message = error.code === "42501" ? "Permission refusée pour modifier ce produit." : error.code === "23514" ? "Les valeurs de seuil ne respectent pas les règles du produit." : "Impossible de paramétrer les alertes.";
      return NextResponse.json({ error: message, diagnostic: databaseDiagnostic(error) }, { status: 400 });
    }
    return NextResponse.json({ product: { id: productId, tenant_id: tenantId, category_id: categoryId, name, stock_family: stockFamily, price, packaging_label: packagingLabel, alert_threshold: alertThreshold, safety_threshold: safetyThreshold } });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
