import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCommerceProductDraft } from "@/lib/commerce-product-validation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productColumns = "id,tenant_id,category_id,primary_supplier_id,internal_code,barcode,supplier_reference,name,description,brand,base_unit,packages,variants,photo_paths,purchase_price_xof,weighted_avg_cost_xof,price_retail_xof,price_semi_wholesale_xof,price_wholesale_xof,tax_rate_basis_points,min_stock,max_stock,reorder_point,track_serial,track_lot,track_expiry,status,created_at,updated_at";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? undefined;
    const search = (url.searchParams.get("q") ?? "").trim();
    const categoryId = url.searchParams.get("categoryId") ?? "";
    const status = url.searchParams.get("status") ?? "ACTIVE";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const offset = Math.min(100000, Math.max(0, Number(url.searchParams.get("offset") ?? 0)));
    if (!Number.isInteger(limit) || !Number.isInteger(offset) || (search && !/^[\p{L}\p{N} ._/-]{1,50}$/u.test(search)) || (categoryId && !uuidPattern.test(categoryId)) || !["ACTIVE", "ARCHIVED", "ALL"].includes(status)) {
      return NextResponse.json({ error: "Filtres de catalogue invalides." }, { status: 400 });
    }
    const access = await authorizeCommerceApi(request, { tenantId, permission: "catalog.view", scope: "catalog:products:read" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    let query = admin.from("commerce_products").select(productColumns, { count: "exact" })
      .eq("tenant_id", access.context.tenantId).order("name", { ascending: true }).order("id", { ascending: true }).range(offset, offset + limit - 1);
    if (status !== "ALL") query = query.eq("status", status);
    if (categoryId) query = query.eq("category_id", categoryId);
    if (search) query = query.or(`name.ilike.${search}%,internal_code.ilike.${search}%,barcode.ilike.${search}%`);
    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger le catalogue." }, { status: 500 });

    const products = data ?? [];
    const [categoryResult, supplierResult] = await Promise.all([
      admin.from("commerce_categories").select("id,name,parent_id,status").eq("tenant_id", access.context.tenantId).limit(500),
      admin.from("commerce_suppliers").select("id,name").eq("tenant_id", access.context.tenantId).limit(1000),
    ]);
    if (categoryResult.error || supplierResult.error) return NextResponse.json({ error: "Impossible de charger les références du catalogue." }, { status: 500 });
    const categoryNames = new Map((categoryResult.data ?? []).map((category) => [category.id, category.name]));
    const supplierNames = new Map((supplierResult.data ?? []).map((supplier) => [supplier.id, supplier.name]));
    const paths = products.flatMap((product) => Array.isArray(product.photo_paths) ? product.photo_paths.filter((path): path is string => typeof path === "string") : []);
    const signedMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await admin.storage.from("commerce-product-images").createSignedUrls(paths, 3600);
      for (const entry of signed ?? []) if (entry.path && entry.signedUrl) signedMap.set(entry.path, entry.signedUrl);
    }
    const canSeeCosts = access.context.isOwner || access.context.permissions.has("costs.view");
    const canSeeSuppliers = access.context.isOwner || access.context.permissions.has("suppliers.view");
    const visibleProducts = products.map((product) => {
      const pathsForProduct = Array.isArray(product.photo_paths) ? product.photo_paths.filter((path): path is string => typeof path === "string") : [];
      const costXof = product.weighted_avg_cost_xof ?? product.purchase_price_xof;
      const common = {
        id: product.id,
        tenant_id: product.tenant_id,
        category_id: product.category_id,
        category_name: categoryNames.get(product.category_id) ?? "Catégorie archivée",
        primary_supplier_id: canSeeSuppliers ? product.primary_supplier_id : null,
        supplier_name: canSeeSuppliers && product.primary_supplier_id ? supplierNames.get(product.primary_supplier_id) ?? null : null,
        internal_code: product.internal_code,
        barcode: product.barcode,
        supplier_reference: canSeeSuppliers ? product.supplier_reference : null,
        name: product.name,
        description: product.description,
        brand: product.brand,
        base_unit: product.base_unit,
        packages: product.packages,
        variants: product.variants,
        photo_paths: pathsForProduct,
        photo_urls: pathsForProduct.map((path) => signedMap.get(path)).filter((url): url is string => Boolean(url)),
        price_retail_xof: product.price_retail_xof,
        price_semi_wholesale_xof: product.price_semi_wholesale_xof,
        price_wholesale_xof: product.price_wholesale_xof,
        tax_rate_basis_points: product.tax_rate_basis_points,
        min_stock: product.min_stock,
        max_stock: product.max_stock,
        reorder_point: product.reorder_point,
        track_serial: product.track_serial,
        track_lot: product.track_lot,
        track_expiry: product.track_expiry,
        status: product.status,
        created_at: product.created_at,
        updated_at: product.updated_at,
      };
      if (!canSeeCosts) return common;
      return { ...common, purchase_price_xof: product.purchase_price_xof, weighted_avg_cost_xof: product.weighted_avg_cost_xof, margin_retail_xof: costXof === null ? null : Number(product.price_retail_xof) - Number(costXof) };
    });
    return NextResponse.json({ products: visibleProducts, total: count ?? visibleProducts.length, limit, offset, canSeeCosts, accessMode: access.context.accessMode });
  } catch {
    return NextResponse.json({ error: "Service Commerce temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await readCommerceJson(request, 128 * 1024);
    if (parsed.response) return parsed.response;
    const body = parsed.body!;
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const access = await authorizeCommerceApi(request, { tenantId, permission: "catalog.manage", write: true, scope: "catalog:products:write" });
    if (access.response) return access.response;
    let draft;
    try { draft = validateCommerceProductDraft(body, access.context.tenantId!); }
    catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Fiche produit invalide." }, { status: 400 }); }
    if ((draft.primarySupplierId || draft.supplierReference) && !access.context.isOwner && !access.context.permissions.has("suppliers.view")) return NextResponse.json({ error: "La permission fournisseurs est requise pour ajouter une référence fournisseur au produit." }, { status: 403 });
    if (body.purchasePriceXof != null && !access.context.isOwner && !access.context.permissions.has("costs.view")) {
      return NextResponse.json({ error: "La permission de consulter les coûts est requise pour saisir un prix d’achat." }, { status: 403 });
    }
    const admin = createSupabaseAdminClient();
    const [{ data: category }, supplierResult] = await Promise.all([
      admin.from("commerce_categories").select("id,status").eq("id", draft.categoryId).eq("tenant_id", access.context.tenantId).maybeSingle(),
      draft.primarySupplierId ? admin.from("commerce_suppliers").select("id,status").eq("id", draft.primarySupplierId).eq("tenant_id", access.context.tenantId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (!category || category.status !== "ACTIVE") return NextResponse.json({ error: "La catégorie doit être active et appartenir à cet établissement." }, { status: 400 });
    if (draft.primarySupplierId && (!supplierResult.data || supplierResult.data.status !== "ACTIVE")) return NextResponse.json({ error: "Le fournisseur principal doit être actif dans cet établissement." }, { status: 400 });
    const { data, error } = await admin.from("commerce_products").insert({
      tenant_id: access.context.tenantId,
      category_id: draft.categoryId,
      primary_supplier_id: draft.primarySupplierId,
      internal_code: draft.internalCode,
      barcode: draft.barcode,
      supplier_reference: draft.supplierReference,
      name: draft.name,
      description: draft.description,
      brand: draft.brand,
      base_unit: draft.baseUnit,
      packages: draft.packages,
      variants: draft.variants,
      photo_paths: draft.photoPaths,
      purchase_price_xof: draft.purchasePriceXof,
      price_retail_xof: draft.priceRetailXof,
      price_semi_wholesale_xof: draft.priceSemiWholesaleXof,
      price_wholesale_xof: draft.priceWholesaleXof,
      tax_rate_basis_points: draft.taxRateBasisPoints,
      min_stock: draft.minStock,
      max_stock: draft.maxStock,
      reorder_point: draft.reorderPoint,
      track_serial: draft.trackSerial,
      track_lot: draft.trackLot,
      track_expiry: draft.trackExpiry,
      created_by: access.context.user!.id,
      updated_by: access.context.user!.id,
    }).select("id,tenant_id,internal_code,name,price_retail_xof,status,created_at").single();
    if (error || !data) {
      const duplicate = error?.code === "23505";
      return NextResponse.json({ error: duplicate ? "Le code interne ou le code-barres existe déjà dans cet établissement." : "Impossible d’enregistrer le produit." }, { status: duplicate ? 409 : 400 });
    }
    return NextResponse.json({ product: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête Commerce invalide." }, { status: 400 });
  }
}
