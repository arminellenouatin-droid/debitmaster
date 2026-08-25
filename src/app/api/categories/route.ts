// DebitManager catalogue API: catégories et sous-catégories tenant-scoped, suppression logique protégée par le stock.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les catégories." }, { status: 403 });
    if (tenantId && !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    let query = context.supabase.from("categories").select("id,tenant_id,parent_id,name,deleted_at,created_at").is("deleted_at", null).order("name").limit(200);
    query = tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", context.tenantIds);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les catégories." }, { status: 500 });
    return NextResponse.json({ categories: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

async function validateParent(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string, parentId: string | null, categoryId?: string) {
  if (!parentId) return true;
  if (parentId === categoryId) return false;
  const { data } = await context.supabase.from("categories").select("id").eq("id", parentId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle();
  return Boolean(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
    if (!tenantId || name.length < 2) return NextResponse.json({ error: "Nom et établissement requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "products.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer les catégories." }, { status: 403 });
    if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    if (!(await validateParent(context, tenantId, parentId))) return NextResponse.json({ error: "Sous-catégorie parente non autorisée." }, { status: 400 });
    const { data, error } = await context.supabase.from("categories").insert({ tenant_id: tenantId, name, parent_id: parentId }).select("id,tenant_id,parent_id,name,created_at").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Cette catégorie existe déjà." : "Impossible de créer la catégorie." }, { status: 400 });
    return NextResponse.json({ category: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
    if (!tenantId || !categoryId || name.length < 2) return NextResponse.json({ error: "Catégorie, nom et établissement requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "products.manage") || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Opération non autorisée." }, { status: 403 });
    if (!(await validateParent(context, tenantId, parentId, categoryId))) return NextResponse.json({ error: "Catégorie parente non autorisée." }, { status: 400 });
    const { data, error } = await context.supabase.from("categories").update({ name, parent_id: parentId }).eq("id", categoryId).eq("tenant_id", tenantId).is("deleted_at", null).select("id,tenant_id,parent_id,name,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible de modifier la catégorie." }, { status: 400 });
    return NextResponse.json({ category: data });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    if (!tenantId || !categoryId) return NextResponse.json({ error: "Catégorie et établissement requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "products.manage") || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Opération non autorisée." }, { status: 403 });
    const { data: children } = await context.supabase.from("categories").select("id").eq("tenant_id", tenantId).eq("parent_id", categoryId).is("deleted_at", null).limit(1);
    if (children?.length) return NextResponse.json({ error: "Cette catégorie contient encore des sous-catégories actives." }, { status: 409 });
    const { data: products } = await context.supabase.from("products").select("id,current_stock").eq("tenant_id", tenantId).eq("category_id", categoryId).is("deleted_at", null).limit(100);
    const productIds = (products ?? []).map((product) => product.id);
    if ((products ?? []).some((product) => Number(product.current_stock ?? 0) > 0)) return NextResponse.json({ error: "Cette catégorie contient encore des produits en stock. Videz les stocks avant de la supprimer." }, { status: 409 });
    if (productIds.length) {
      const { data: stocked } = await context.supabase.from("store_inventory").select("product_id").in("product_id", productIds).gt("quantity", 0).limit(1);
      if (stocked?.length) return NextResponse.json({ error: "Cette catégorie contient encore des produits en stock. Videz les stocks avant de la supprimer." }, { status: 409 });
    }
    const { error } = await context.supabase.from("categories").update({ deleted_at: new Date().toISOString() }).eq("id", categoryId).eq("tenant_id", tenantId).is("deleted_at", null);
    if (error) return NextResponse.json({ error: "Impossible de supprimer la catégorie." }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
