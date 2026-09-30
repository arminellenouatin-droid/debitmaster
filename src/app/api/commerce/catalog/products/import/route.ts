import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceFormData } from "@/lib/commerce-api";
import { commerceProductImportHeaders, maxCommerceImportBytes, maxCommerceImportRows, normalizeImportHeader, parseCommerceCsv, parseOptionalBoolean, parseOptionalInteger, parseOptionalQuantity } from "@/lib/commerce-catalog";
import { validateCommerceProductDraft } from "@/lib/commerce-product-validation";
import { readCommerceWorkbookRows } from "@/lib/commerce-xlsx";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ImportRowError = { row: number; message: string };

const getCell = (row: string[], index: Map<string, number>, key: string) => {
  const column = index.get(key);
  return column === undefined ? "" : String(row[column] ?? "").trim();
};

function parseTaxRate(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!normalized) return 0;
  return normalized.endsWith("%") ? Number(normalized.slice(0, -1)) : Number(normalized);
}

export async function POST(request: Request) {
  try {
    const access = await authorizeCommerceApi(request, { permission: "catalog.manage", write: true, scope: "catalog:products:import", limit: 3, windowSeconds: 60 });
    if (access.response) return access.response;
    const parsedForm = await readCommerceFormData(request, maxCommerceImportBytes + 64 * 1024);
    if (parsedForm.response) return parsedForm.response;
    const form = parsedForm.form!;
    const requestedTenantId = typeof form.get("tenantId") === "string" ? String(form.get("tenantId")) : access.context.tenantId;
    if (requestedTenantId !== access.context.tenantId) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choisissez un fichier CSV ou Excel (.xlsx)." }, { status: 400 });
    if (file.size < 1 || file.size > maxCommerceImportBytes) return NextResponse.json({ error: "Le fichier doit peser au maximum 5 Mo." }, { status: 413 });
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "csv" && extension !== "xlsx") return NextResponse.json({ error: "Formats acceptés : CSV UTF-8 ou Excel .xlsx (sans macros)." }, { status: 415 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    let rows: string[][];
    try {
      if (extension === "csv") rows = parseCommerceCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      else rows = readCommerceWorkbookRows(bytes, maxCommerceImportRows, commerceProductImportHeaders.length);
    } catch (cause) {
      return NextResponse.json({ error: cause instanceof Error ? cause.message : "Le fichier ne peut pas être lu." }, { status: 400 });
    }
    if (rows.length < 2 || rows.length - 1 > maxCommerceImportRows) return NextResponse.json({ error: "Le fichier doit contenir de 1 à 1 000 produits sous la ligne d’en-tête." }, { status: 400 });
    const headers = rows[0].map(normalizeImportHeader);
    if (new Set(headers).size !== headers.length) return NextResponse.json({ error: "Chaque colonne du fichier doit avoir un en-tête distinct." }, { status: 400 });
    const allowedHeaders = new Set(["code_interne","nom","description","categorie","sous_categorie","marque","unite","conditionnements_json","variantes_json","code_barres","reference_fournisseur","fournisseur_principal","prix_achat_xof","prix_vente_detail_xof","prix_vente_semi_gros_xof","prix_vente_gros_xof","tva_pourcentage","stock_minimum","stock_maximum","seuil_reapprovisionnement","suivre_numero_serie","suivre_lot","suivre_date_expiration"]);
    if (headers.some((header) => !allowedHeaders.has(header))) return NextResponse.json({ error: "Le fichier contient un en-tête inconnu. Téléchargez le modèle CSV/Excel DebitMaster." }, { status: 400 });
    const index = new Map(headers.map((header, column) => [header, column]));
    const required = ["code_interne", "nom", "categorie", "prix_vente_detail_xof"];
    if (required.some((header) => !index.has(header))) return NextResponse.json({ error: "Colonnes requises : code_interne, nom, categorie, prix_vente_detail_xof." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const [categoryResult, supplierResult] = await Promise.all([
      admin.from("commerce_categories").select("id,name,parent_id,status").eq("tenant_id", access.context.tenantId).limit(500),
      admin.from("commerce_suppliers").select("id,name,supplier_code,status").eq("tenant_id", access.context.tenantId).limit(1000),
    ]);
    if (categoryResult.error || supplierResult.error) return NextResponse.json({ error: "Impossible de vérifier les catégories et fournisseurs." }, { status: 500 });
    const categories = categoryResult.data ?? [];
    const suppliers = (supplierResult.data ?? []).filter((supplier) => supplier.status === "ACTIVE");
    const normalize = (value: string) => normalizeImportHeader(value);
    const drafts: Array<{ rowNumber: number; data: Record<string, unknown> }> = [];
    const errors: ImportRowError[] = [];
    const seenCodes = new Set<string>();
    const seenBarcodes = new Set<string>();
    let containsPurchaseCost = false;

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      if (!row.some((cell) => cell.trim() !== "")) continue;
      const rowNumber = rowIndex + 1;
      try {
        const parentName = getCell(row, index, "categorie");
        const childName = getCell(row, index, "sous_categorie");
        const parent = categories.find((category) => category.status === "ACTIVE" && !category.parent_id && normalize(category.name) === normalize(parentName));
        if (!parent) throw new Error("Catégorie principale introuvable ou archivée.");
        const category = childName
          ? categories.find((item) => item.status === "ACTIVE" && item.parent_id === parent.id && normalize(item.name) === normalize(childName))
          : parent;
        if (!category) throw new Error("Sous-catégorie introuvable sous la catégorie choisie.");
        const supplierName = getCell(row, index, "fournisseur_principal");
        const supplierReference = getCell(row, index, "reference_fournisseur");
        if ((supplierName || supplierReference) && !access.context.isOwner && !access.context.permissions.has("suppliers.view")) throw new Error("La permission fournisseurs est requise pour importer ces références.");
        const supplier = supplierName ? suppliers.find((item) => normalize(item.name) === normalize(supplierName) || normalize(String(item.supplier_code ?? "")) === normalize(supplierName)) : null;
        if (supplierName && !supplier) throw new Error("Fournisseur principal introuvable ou archivé.");
        const internalCode = getCell(row, index, "code_interne");
        const barcode = getCell(row, index, "code_barres");
        const foldedCode = internalCode.toLocaleLowerCase("fr-FR");
        if (seenCodes.has(foldedCode)) throw new Error("Code interne dupliqué dans le fichier.");
        seenCodes.add(foldedCode);
        if (barcode) {
          const foldedBarcode = barcode.toLocaleLowerCase("fr-FR");
          if (seenBarcodes.has(foldedBarcode)) throw new Error("Code-barres dupliqué dans le fichier.");
          seenBarcodes.add(foldedBarcode);
        }
        const purchasePrice = parseOptionalInteger(getCell(row, index, "prix_achat_xof"), "Prix d’achat");
        if (purchasePrice !== null) containsPurchaseCost = true;
        const packagesCell = getCell(row, index, "conditionnements_json");
        const variantsCell = getCell(row, index, "variantes_json");
        let packages: unknown = [];
        let variants: unknown = [];
        try { if (packagesCell) packages = JSON.parse(packagesCell); } catch { throw new Error("Conditionnements JSON invalides."); }
        try { if (variantsCell) variants = JSON.parse(variantsCell); } catch { throw new Error("Variantes JSON invalides."); }
        const draftInput = {
          categoryId: category.id,
          primarySupplierId: supplier?.id ?? null,
          internalCode,
          barcode,
          supplierReference,
          name: getCell(row, index, "nom"),
          description: getCell(row, index, "description"),
          brand: getCell(row, index, "marque"),
          baseUnit: getCell(row, index, "unite") || "unité",
          packages,
          variants,
          photoPaths: [],
          purchasePriceXof: purchasePrice,
          priceRetailXof: getCell(row, index, "prix_vente_detail_xof"),
          priceSemiWholesaleXof: parseOptionalInteger(getCell(row, index, "prix_vente_semi_gros_xof"), "Prix semi-gros"),
          priceWholesaleXof: parseOptionalInteger(getCell(row, index, "prix_vente_gros_xof"), "Prix de gros"),
          taxRatePercent: parseTaxRate(getCell(row, index, "tva_pourcentage")),
          minStock: parseOptionalQuantity(getCell(row, index, "stock_minimum"), "Stock minimum") ?? 0,
          maxStock: parseOptionalQuantity(getCell(row, index, "stock_maximum"), "Stock maximum"),
          reorderPoint: parseOptionalQuantity(getCell(row, index, "seuil_reapprovisionnement"), "Seuil de réapprovisionnement") ?? 0,
          trackSerial: parseOptionalBoolean(getCell(row, index, "suivre_numero_serie"), "Suivi numéro de série"),
          trackLot: parseOptionalBoolean(getCell(row, index, "suivre_lot"), "Suivi lot"),
          trackExpiry: parseOptionalBoolean(getCell(row, index, "suivre_date_expiration"), "Suivi date d’expiration"),
        };
        const validated = validateCommerceProductDraft(draftInput, access.context.tenantId!);
        drafts.push({ rowNumber, data: {
          tenant_id: access.context.tenantId,
          category_id: validated.categoryId,
          primary_supplier_id: validated.primarySupplierId,
          internal_code: validated.internalCode,
          barcode: validated.barcode,
          supplier_reference: validated.supplierReference,
          name: validated.name,
          description: validated.description,
          brand: validated.brand,
          base_unit: validated.baseUnit,
          packages: validated.packages,
          variants: validated.variants,
          photo_paths: validated.photoPaths,
          purchase_price_xof: validated.purchasePriceXof,
          price_retail_xof: validated.priceRetailXof,
          price_semi_wholesale_xof: validated.priceSemiWholesaleXof,
          price_wholesale_xof: validated.priceWholesaleXof,
          tax_rate_basis_points: validated.taxRateBasisPoints,
          min_stock: validated.minStock,
          max_stock: validated.maxStock,
          reorder_point: validated.reorderPoint,
          track_serial: validated.trackSerial,
          track_lot: validated.trackLot,
          track_expiry: validated.trackExpiry,
          created_by: access.context.user!.id,
          updated_by: access.context.user!.id,
        } });
      } catch (cause) {
        errors.push({ row: rowNumber, message: cause instanceof Error ? cause.message : "Ligne invalide." });
        if (errors.length >= 25) break;
      }
    }
    if (containsPurchaseCost && !access.context.isOwner && !access.context.permissions.has("costs.view")) {
      return NextResponse.json({ error: "La permission de consulter les coûts est requise pour importer les prix d’achat." }, { status: 403 });
    }
    if (errors.length) return NextResponse.json({ error: "Aucun produit n’a été importé. Corrigez les lignes signalées puis réessayez.", rowErrors: errors }, { status: 422 });
    if (!drafts.length) return NextResponse.json({ error: "Le fichier ne contient aucun produit à importer." }, { status: 400 });
    const { error } = await admin.from("commerce_products").insert(drafts.map((item) => item.data));
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Un code interne ou code-barres est déjà utilisé. Aucun produit n’a été importé." : "Impossible d’importer les produits. Aucun produit n’a été importé." }, { status: error.code === "23505" ? 409 : 400 });
    return NextResponse.json({ imported: drafts.length, errors: [] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Le fichier ou la requête d’import est invalide." }, { status: 400 });
  }
}
