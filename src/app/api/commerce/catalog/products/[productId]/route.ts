import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCommerceProductDraft } from "@/lib/commerce-product-validation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ productId: string }> };
const toDraft = (product: Record<string, unknown>) => ({
  categoryId: product.category_id, primarySupplierId: product.primary_supplier_id, internalCode: product.internal_code,
  barcode: product.barcode, supplierReference: product.supplier_reference, name: product.name, description: product.description,
  brand: product.brand, baseUnit: product.base_unit, packages: product.packages, variants: product.variants,
  photoPaths: product.photo_paths, purchasePriceXof: product.purchase_price_xof, priceRetailXof: product.price_retail_xof,
  priceSemiWholesaleXof: product.price_semi_wholesale_xof, priceWholesaleXof: product.price_wholesale_xof,
  taxRatePercent: Number(product.tax_rate_basis_points ?? 0) / 100, minStock: product.min_stock, maxStock: product.max_stock,
  reorderPoint: product.reorder_point, trackSerial: product.track_serial, trackLot: product.track_lot, trackExpiry: product.track_expiry,
});

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { productId } = await params;
    if (!uuidPattern.test(productId)) return NextResponse.json({ error: "Produit invalide." }, { status: 400 });
    const parsed = await readCommerceJson(request, 128 * 1024);
    if (parsed.response) return parsed.response;
    const body = parsed.body!;
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const access = await authorizeCommerceApi(request, { tenantId, permission: "catalog.manage", write: true, scope: "catalog:products:write" });
    if (access.response) return access.response;
    const canManageCostFields = access.context.isOwner || access.context.permissions.has("costs.view");
    if (body.purchasePriceXof != null && !canManageCostFields) {
      return NextResponse.json({ error: "La permission de consulter les coûts est requise pour modifier le prix d’achat." }, { status: 403 });
    }
    const admin = createSupabaseAdminClient();
    const { data: existing, error: readError } = await admin.from("commerce_products").select("*").eq("id", productId).eq("tenant_id", access.context.tenantId).maybeSingle();
    if (readError || !existing) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    const status = body.status === undefined ? existing.status : body.status;
    if (status !== "ACTIVE" && status !== "ARCHIVED") return NextResponse.json({ error: "Statut produit invalide." }, { status: 400 });
    let draft;
    const canManageSupplierFields = access.context.isOwner || access.context.permissions.has("suppliers.view");
    const draftInput = { ...toDraft(existing as Record<string, unknown>), ...body,
      ...(!canManageCostFields ? { purchasePriceXof: existing.purchase_price_xof } : {}),
      ...(!canManageSupplierFields ? { primarySupplierId: existing.primary_supplier_id, supplierReference: existing.supplier_reference } : {}),
    };
    try { draft = validateCommerceProductDraft(draftInput, access.context.tenantId!); }
    catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Fiche produit invalide." }, { status: 400 }); }
    if ((draft.primarySupplierId !== existing.primary_supplier_id || draft.supplierReference !== existing.supplier_reference) && !access.context.isOwner && !access.context.permissions.has("suppliers.view")) return NextResponse.json({ error: "La permission fournisseurs est requise pour modifier les références fournisseur du produit." }, { status: 403 });
    const [{ data: category }, supplierResult] = await Promise.all([
      admin.from("commerce_categories").select("id,status").eq("id", draft.categoryId).eq("tenant_id", access.context.tenantId).maybeSingle(),
      draft.primarySupplierId ? admin.from("commerce_suppliers").select("id,status").eq("id", draft.primarySupplierId).eq("tenant_id", access.context.tenantId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (!category || (category.status !== "ACTIVE" && draft.categoryId !== existing.category_id)) return NextResponse.json({ error: "La nouvelle catégorie doit être active et appartenir à cet établissement." }, { status: 400 });
    if (draft.primarySupplierId && (!supplierResult.data || (supplierResult.data.status !== "ACTIVE" && draft.primarySupplierId !== existing.primary_supplier_id))) return NextResponse.json({ error: "Le fournisseur doit être actif dans cet établissement." }, { status: 400 });
    const { data, error } = await admin.from("commerce_products").update({
      category_id: draft.categoryId, primary_supplier_id: draft.primarySupplierId, internal_code: draft.internalCode,
      barcode: draft.barcode, supplier_reference: draft.supplierReference, name: draft.name, description: draft.description,
      brand: draft.brand, base_unit: draft.baseUnit, packages: draft.packages, variants: draft.variants, photo_paths: draft.photoPaths,
      purchase_price_xof: draft.purchasePriceXof, price_retail_xof: draft.priceRetailXof,
      price_semi_wholesale_xof: draft.priceSemiWholesaleXof, price_wholesale_xof: draft.priceWholesaleXof,
      tax_rate_basis_points: draft.taxRateBasisPoints, min_stock: draft.minStock, max_stock: draft.maxStock,
      reorder_point: draft.reorderPoint, track_serial: draft.trackSerial, track_lot: draft.trackLot, track_expiry: draft.trackExpiry,
      status, updated_by: access.context.user!.id, updated_at: new Date().toISOString(),
    }).eq("id", productId).eq("tenant_id", access.context.tenantId).select("id,tenant_id,internal_code,name,status,updated_at").single();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Le code interne ou le code-barres existe déjà dans cet établissement." : "Impossible de modifier le produit." }, { status: error?.code === "23505" ? 409 : 400 });

    const previousPaths: string[] = Array.isArray(existing.photo_paths) ? (existing.photo_paths as unknown[]).filter((path: unknown): path is string => typeof path === "string") : [];
    const removedPaths = previousPaths.filter((path) => !draft.photoPaths.includes(path));
    if (removedPaths.length) {
      const { error: storageError } = await admin.storage.from("commerce-product-images").remove(removedPaths);
      if (storageError) console.error("[commerce.catalog] removed photo cleanup failed", { code: storageError.name });
    }
    return NextResponse.json({ product: data });
  } catch {
    return NextResponse.json({ error: "Requête Commerce invalide." }, { status: 400 });
  }
}
