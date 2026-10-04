// DebitMaster Stock Import API: Importation en masse de stocks depuis Excel (.xlsx, .xls) ou CSV.
// RÈGLE MÉTIER STRICTE : Concerne UNIQUEMENT les produits physiques avec stock. Les services (sans gestion de stock) sont formellement exclus/ignorés.
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface ParsedRow {
  name: string;
  quantity: number;
  salePrice: number;
  purchasePrice?: number;
  stockFamily: "BEVERAGE" | "KITCHEN";
  packagingLabel?: string;
  unit: string;
  alertThreshold: number;
  safetyThreshold: number;
  isService?: boolean;
}

export async function POST(request: Request) {
  try {
    const context = await getAuthorizationContext();
    const { user, tenantIds } = context;

    if (!user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const canImportStock =
      can(context, "stock.receive") ||
      can(context, "stock.adjust") ||
      can(context, "products.manage") ||
      context.role === "ADMINISTRATEUR" ||
      context.role === "GERANT" ||
      context.role === "APPROVISIONNEMENT" ||
      context.role === "MAGASINIER";

    if (!canImportStock) {
      return NextResponse.json(
        { error: "Permission insuffisante pour importer du stock." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const tenantId = (formData.get("tenantId") as string) || "";
    const mode = (formData.get("mode") as string) || "ADD"; // "ADD" (ajouter au stock existant) ou "REPLACE" (remplacer le stock)
    const storeId = (formData.get("storeId") as string) || "";
    const file = formData.get("file") as File | null;

    if (!tenantId || !tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch {
      return NextResponse.json(
        { error: "Format de fichier non reconnu. Veuillez déposer un fichier Excel (.xlsx, .xls) ou CSV valide." },
        { status: 400 }
      );
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "Le classeur ne contient aucune feuille." }, { status: 400 });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: "Le fichier est vide ou ne contient aucune donnée." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Déterminer le magasin cible (ou le magasin principal de l'établissement)
    let targetStoreId = storeId;
    if (!targetStoreId) {
      const { data: defaultStore } = await admin
        .from("stores")
        .select("id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      targetStoreId = defaultStore?.id ?? "";
    }

    // 2. Charger les produits existants de l'établissement
    const { data: existingProducts } = await admin
      .from("products")
      .select("id, name, product_type, stock_family, current_stock, price, unit")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    const productMapByName = new Map<string, { id: string; name: string; product_type: string; current_stock: number; price: number }>();
    for (const p of existingProducts ?? []) {
      productMapByName.set(p.name.trim().toLowerCase(), p);
    }

    const results = {
      totalRows: rawData.length,
      processed: 0,
      created: 0,
      updated: 0,
      skippedServices: 0,
      errors: [] as string[],
    };

    // 3. Parcourir chaque ligne
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowIndex = i + 2; // Numéro de ligne dans le fichier

      // Recherche souple des colonnes
      const findVal = (keys: string[]): string => {
        for (const k of keys) {
          const matchingKey = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
          if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
            return String(row[matchingKey]).trim();
          }
        }
        return "";
      };

      const name = findVal(["nom du produit", "nom", "designation", "article", "produit", "libelle", "item"]);
      const qtyStr = findVal(["quantité en stock", "quantite en stock", "quantité", "quantite", "stock", "stock actuel", "qty"]);
      const salePriceStr = findVal(["prix de vente (xof)", "prix de vente", "prix vente", "prix", "pu vente", "pv"]);
      const purchasePriceStr = findVal(["prix d'achat unitaire (xof)", "prix d'achat", "prix achat", "cout d'achat", "pa", "cmp"]);
      const familyStr = findVal(["famille", "type de stock", "stock_family", "rayon", "famille de stock"]);
      const packaging = findVal(["conditionnement", "label", "contenance", "volume", "taille"]);
      const unit = findVal(["unité", "unite", "base_unit", "mesure"]) || "unité";
      const alertThStr = findVal(["seuil d'alerte", "alerte", "seuil alerte", "stock mini"]);
      const safetyThStr = findVal(["seuil de sécurité", "seuil de securite", "securite", "stock securite"]);
      const productTypeStr = findVal(["type", "type de produit", "product_type", "nature"]);

      if (!name) {
        // Ligne vide
        continue;
      }

      // RÈGLE MÉTIER STRICTE : Vérification si c'est un SERVICE (exclure du stock)
      const isServiceExplicit =
        productTypeStr.toUpperCase() === "SERVICE" ||
        familyStr.toUpperCase() === "SERVICE" ||
        name.toLowerCase().startsWith("service ") ||
        name.toLowerCase().includes("(service)");

      const existingProd = productMapByName.get(name.toLowerCase());
      if (existingProd?.product_type === "SERVICE" || isServiceExplicit) {
        results.skippedServices++;
        continue;
      }

      const quantity = Number(qtyStr.replace(/\s/g, "").replace(",", "."));
      if (isNaN(quantity) || quantity < 0) {
        results.errors.push(`Ligne ${rowIndex} (« ${name} ») : Quantité invalide ou négative (« ${qtyStr} »).`);
        continue;
      }

      const salePrice = Number(salePriceStr.replace(/\s/g, "").replace(",", ".")) || (existingProd ? existingProd.price : 0);
      const purchasePrice = purchasePriceStr ? Number(purchasePriceStr.replace(/\s/g, "").replace(",", ".")) : undefined;
      const alertThreshold = Number(alertThStr) >= 0 ? Math.round(Number(alertThStr)) : 10;
      const safetyThreshold = Number(safetyThStr) >= 0 ? Math.round(Number(safetyThStr)) : 5;

      const stockFamily: "BEVERAGE" | "KITCHEN" =
        familyStr.toUpperCase().includes("CUISINE") || familyStr.toUpperCase() === "KITCHEN"
          ? "KITCHEN"
          : "BEVERAGE";

      let productId = existingProd?.id;
      let newCalculatedStock = quantity;

      if (existingProd) {
        // Produit déjà présent
        const currentQty = Number(existingProd.current_stock || 0);
        newCalculatedStock = mode === "ADD" ? currentQty + quantity : quantity;

        // Mise à jour de la table products
        const { error: updateError } = await admin
          .from("products")
          .update({
            current_stock: newCalculatedStock,
            price: salePrice > 0 ? Math.round(salePrice) : existingProd.price,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProd.id)
          .eq("tenant_id", tenantId);

        if (updateError) {
          results.errors.push(`Ligne ${rowIndex} (« ${name} ») : Échec de mise à jour du produit.`);
          continue;
        }

        results.updated++;
      } else {
        // Création d'un nouveau produit physique avec gestion de stock
        const { data: newProd, error: insertError } = await admin
          .from("products")
          .insert({
            tenant_id: tenantId,
            name: name.slice(0, 180),
            product_type: "UNIT",
            stock_family: stockFamily,
            unit: unit.slice(0, 40),
            packaging_label: packaging ? packaging.slice(0, 80) : null,
            price: Math.round(salePrice),
            current_stock: Math.round(quantity),
            alert_threshold: alertThreshold,
            safety_threshold: safetyThreshold,
          })
          .select("id")
          .single();

        if (insertError || !newProd) {
          results.errors.push(`Ligne ${rowIndex} (« ${name} ») : Impossible de créer le produit.`);
          continue;
        }

        productId = newProd.id;
        productMapByName.set(name.toLowerCase(), {
          id: newProd.id,
          name,
          product_type: "UNIT",
          current_stock: quantity,
          price: salePrice,
        });
        results.created++;
      }

      // Mise à jour du stock dans le magasin cible si présent
      if (targetStoreId && productId) {
        const { data: storePos } = await admin
          .from("store_inventory")
          .select("quantity")
          .eq("tenant_id", tenantId)
          .eq("store_id", targetStoreId)
          .eq("product_id", productId)
          .maybeSingle();

        const storeTargetQty = mode === "ADD" && storePos ? Number(storePos.quantity || 0) + quantity : quantity;

        await admin
          .from("store_inventory")
          .upsert(
            {
              tenant_id: tenantId,
              store_id: targetStoreId,
              product_id: productId,
              quantity: Math.round(storeTargetQty),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,store_id,product_id" }
          );
      }

      // Enregistrement du mouvement de stock
      if (productId && quantity > 0) {
        await admin.from("stock_movements").insert({
          tenant_id: tenantId,
          product_id: productId,
          movement_type: mode === "ADD" ? "IN_PURCHASE" : "ADJUSTMENT",
          quantity: Math.round(quantity),
          reason: `Import de stock par fichier (${mode === "ADD" ? "Ajout" : "Remplacement"})`,
          responsible_user_id: user.id,
        });

        // Si un prix d'achat a été renseigné, enregistrer un approvisionnement pour calcul du CMP
        if (purchasePrice && purchasePrice > 0 && targetStoreId) {
          await admin.from("stock_purchases").insert({
            tenant_id: tenantId,
            store_id: targetStoreId,
            product_id: productId,
            quantity: Math.round(quantity),
            purchase_unit_price: Math.round(purchasePrice),
            purchased_at: new Date().toISOString(),
            responsible_user_id: user.id,
          });
        }
      }

      results.processed++;
    }

    return NextResponse.json({
      success: true,
      message: `Import terminé avec succès : ${results.processed} produit(s) traité(s) (${results.created} créé(s), ${results.updated} mis à jour).`,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Une erreur est survenue pendant l'importation.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
