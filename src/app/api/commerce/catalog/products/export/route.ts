import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { authorizeCommerceApi } from "@/lib/commerce-api";
import { commerceProductImportHeaders, serializeCommerceCsv } from "@/lib/commerce-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const productColumns = "id,category_id,primary_supplier_id,internal_code,barcode,supplier_reference,name,description,brand,base_unit,packages,variants,purchase_price_xof,price_retail_xof,price_semi_wholesale_xof,price_wholesale_xof,tax_rate_basis_points,min_stock,max_stock,reorder_point,track_serial,track_lot,track_expiry,status";
const safeSpreadsheetValue = (value: string | number | null) => typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? undefined;
    const format = url.searchParams.get("format") ?? "csv";
    const template = url.searchParams.get("template") === "1";
    if (!["csv", "xlsx"].includes(format)) return NextResponse.json({ error: "Format d’export invalide." }, { status: 400 });
    const access = await authorizeCommerceApi(request, { tenantId, permission: "catalog.view", scope: template ? "catalog:template:download" : "catalog:products:export", limit: template ? 20 : 10 });
    if (access.response) return access.response;
    if (!template && !access.context.isOwner && !access.context.permissions.has("reports.export")) {
      return NextResponse.json({ error: "La permission d’export des rapports est requise." }, { status: 403 });
    }
    const includeCosts = access.context.isOwner || access.context.permissions.has("costs.view");
    const includeSuppliers = access.context.isOwner || access.context.permissions.has("suppliers.view");
    const headers = [...commerceProductImportHeaders].filter((header) => includeCosts || header !== "prix_achat_xof");
    let rows: Array<Array<string | number | null>> = [headers.map(safeSpreadsheetValue)];
    if (!template) {
      const admin = createSupabaseAdminClient();
      const baseQuery = admin.from("commerce_products")
        .select(productColumns, { count: "exact" }).eq("tenant_id", access.context.tenantId).eq("status", "ACTIVE")
        .order("name", { ascending: true }).order("id", { ascending: true });
      const { data: firstPage, error, count } = await baseQuery.range(0, 999);
      if (error) return NextResponse.json({ error: "Impossible de préparer l’export." }, { status: 500 });
      if ((count ?? 0) > 10000) return NextResponse.json({ error: "L’export dépasse 10 000 produits. Réduisez le catalogue avant d’exporter." }, { status: 413 });
      const products = [...(firstPage ?? [])];
      for (let start = 1000; start < (count ?? products.length); start += 1000) {
        const { data: page, error: pageError } = await admin.from("commerce_products")
          .select(productColumns).eq("tenant_id", access.context.tenantId).eq("status", "ACTIVE")
          .order("name", { ascending: true }).order("id", { ascending: true }).range(start, Math.min(start + 999, 9999));
        if (pageError) return NextResponse.json({ error: "Impossible de préparer l’export complet." }, { status: 500 });
        products.push(...(page ?? []));
      }
      const categoryResult = await admin.from("commerce_categories").select("id,name,parent_id").eq("tenant_id", access.context.tenantId).limit(500);
      const supplierResult = await admin.from("commerce_suppliers").select("id,name").eq("tenant_id", access.context.tenantId).limit(1000);
      if (categoryResult.error || supplierResult.error) return NextResponse.json({ error: "Impossible de préparer les références de l’export." }, { status: 500 });
      const categories = new Map((categoryResult.data ?? []).map((item) => [item.id, item]));
      const suppliers = new Map((supplierResult.data ?? []).map((item) => [item.id, item.name]));
      const valuesByKey = (product: (typeof products)[number]) => {
        const category = categories.get(product.category_id);
        const parent = category?.parent_id ? categories.get(category.parent_id) : null;
        const fields: Record<string, string | number | null> = {
          code_interne: product.internal_code,
          nom: product.name,
          description: product.description,
          categorie: parent?.name ?? category?.name ?? "",
          sous_categorie: parent ? category?.name ?? "" : "",
          marque: product.brand,
          unite: product.base_unit,
          conditionnements_json: JSON.stringify(product.packages ?? []),
          variantes_json: JSON.stringify(product.variants ?? []),
          code_barres: product.barcode,
          reference_fournisseur: includeSuppliers ? product.supplier_reference : null,
          fournisseur_principal: includeSuppliers && product.primary_supplier_id ? suppliers.get(product.primary_supplier_id) ?? "" : null,
          prix_achat_xof: includeCosts ? product.purchase_price_xof : null,
          prix_vente_detail_xof: product.price_retail_xof,
          prix_vente_semi_gros_xof: product.price_semi_wholesale_xof,
          prix_vente_gros_xof: product.price_wholesale_xof,
          tva_pourcentage: Number(product.tax_rate_basis_points) / 100,
          stock_minimum: product.min_stock,
          stock_maximum: product.max_stock,
          seuil_reapprovisionnement: product.reorder_point,
          suivre_numero_serie: product.track_serial ? "oui" : "non",
          suivre_lot: product.track_lot ? "oui" : "non",
          suivre_date_expiration: product.track_expiry ? "oui" : "non",
        };
        return headers.map((header) => safeSpreadsheetValue(fields[header] ?? null));
      };
      rows = [...rows, ...products.map(valuesByKey)];
    }
    const filename = template ? `modele-produits-commerce.${format}` : `catalogue-commerce.${format}`;
    if (format === "csv") {
      const csv = serializeCommerceCsv(rows);
      return new NextResponse(`\uFEFF${csv}`, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Produits");
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    return new NextResponse(output, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Service Commerce temporairement indisponible." }, { status: 500 });
  }
}
