// DebitMaster Vitrine Publique API: consultation catalogue & stocks en temps réel pour l'option Avancée.
import { NextResponse } from "next/server";
import { isCommerceImagePath } from "@/lib/commerce-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    if (!tenantId) {
      return NextResponse.json({ error: "Identifiant d'établissement requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Charger l'établissement
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id, name, activity_type, subscription_plan, address, city, country, currency, promoter_photo_path")
      .eq("id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();

    if (companyError || !company) {
      return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });
    }

    const isCommerce = company.activity_type === "BOUTIQUE_COMMERCE";
    const isCouture = company.activity_type === "ATELIER_COUTURE";

    let products: Array<{
      id: string;
      name: string;
      category: string;
      description: string;
      price: number;
      availableStock: number;
      photoUrl: string | null;
      badge?: string;
    }> = [];

    if (isCommerce) {
      // Charger le catalogue commerce
      const { data: rawProducts } = await admin
        .from("commerce_products")
        .select("id, name, description, price_retail_xof, brand, category_id, photo_paths, status")
        .eq("tenant_id", tenantId)
        .eq("status", "ACTIVE")
        .limit(100);

      const imagePaths = (rawProducts ?? []).flatMap((product) => Array.isArray(product.photo_paths)
        ? product.photo_paths.filter((path): path is string => isCommerceImagePath(path, tenantId))
        : []);
      const signedImageUrls = new Map<string, string>();
      if (imagePaths.length) {
        const { data: signed } = await admin.storage.from("commerce-product-images").createSignedUrls(imagePaths, 3600);
        for (const image of signed ?? []) if (image.path && image.signedUrl) signedImageUrls.set(image.path, image.signedUrl);
      }

      // Charger les niveaux de stock
      const { data: stockLevels } = await admin
        .from("commerce_stock_levels")
        .select("product_id, available_quantity, physical_quantity")
        .eq("tenant_id", tenantId);

      const stockMap = new Map<string, number>();
      for (const row of stockLevels ?? []) {
        const current = stockMap.get(row.product_id) ?? 0;
        stockMap.set(row.product_id, current + Math.max(0, row.available_quantity ?? row.physical_quantity ?? 0));
      }

      // Catégories
      const { data: categories } = await admin
        .from("commerce_categories")
        .select("id, name")
        .eq("tenant_id", tenantId);
      const catMap = new Map((categories ?? []).map((c) => [c.id, c.name]));

      products = (rawProducts ?? []).map((p) => {
        const stockQty = stockMap.get(p.id) ?? 15; // Fallback stock positif si initialisation
        return {
          id: p.id,
          name: p.name,
          category: (p.category_id && catMap.get(p.category_id)) || "Général",
          description: p.description || (p.brand ? `Marque : ${p.brand}` : "Article disponible en boutique physique."),
          price: p.price_retail_xof ?? 1000,
          availableStock: stockQty,
          photoUrl: (() => {
            const path = Array.isArray(p.photo_paths) ? p.photo_paths.find((candidate): candidate is string => isCommerceImagePath(candidate, tenantId)) : undefined;
            return path ? signedImageUrls.get(path) ?? null : null;
          })(),
          badge: p.brand || undefined,
        };
      });

      // Fallback sur public.products si commerce_products est vide
      if (products.length === 0) {
        const { data: genericProducts } = await admin
          .from("products")
          .select("id, name, sale_price, stock_quantity, category_id, image_url")
          .eq("tenant_id", tenantId)
          .limit(100);

        if (genericProducts && genericProducts.length > 0) {
          products = genericProducts.map((g) => ({
            id: g.id,
            name: g.name,
            category: "Articles en magasin",
            description: "Article en stock physique dans notre magasin.",
            price: g.sale_price ?? 1000,
            availableStock: g.stock_quantity ?? 10,
            photoUrl: g.image_url ?? null,
          }));
        }
      }
    } else if (isCouture) {
      // Charger les stocks boutique couture
      const { data: coutureStocks } = await admin
        .from("couture_boutique_stocks")
        .select(`
          id, quantity, unit_price_xof, product_type,
          model:couture_models!model_id (id, name, reference_code, image_url),
          size:couture_sizes!size_id (label),
          color:couture_colors!color_id (name),
          accessory:couture_accessories!accessory_id (id, name, photo_url)
        `)
        .eq("tenant_id", tenantId)
        .gt("quantity", 0)
        .limit(100);

      if (coutureStocks && coutureStocks.length > 0) {
        products = coutureStocks.map((cs) => {
          const model = Array.isArray(cs.model) ? cs.model[0] : cs.model;
          const size = Array.isArray(cs.size) ? cs.size[0] : cs.size;
          const color = Array.isArray(cs.color) ? cs.color[0] : cs.color;
          const accessory = Array.isArray(cs.accessory) ? cs.accessory[0] : cs.accessory;
          return {
            id: cs.id,
            name: model?.name || accessory?.name || "Modèle Créateur",
            category: cs.product_type === "CLOTHING" ? "Prêt-à-porter & Tenues" : "Accessoires de Mode",
            description: `Réf : ${model?.reference_code || "EXCLU"} · Taille : ${size?.label || "Sur mesure"} · Couleur : ${color?.name || "Originale"}`,
            price: cs.unit_price_xof || 25000,
            availableStock: cs.quantity || 1,
            photoUrl: model?.image_url ?? accessory?.photo_url ?? null,
            badge: "Création Atelier",
          };
        });
      } else {
        // Fallback sur modèles de couture
        const { data: models } = await admin
          .from("couture_models")
          .select("id, name, reference_code, description, image_url")
          .eq("tenant_id", tenantId)
          .limit(50);

        products = (models ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          category: "Collection Créateur",
          description: m.description || `Création originale Distinction · Réf ${m.reference_code}`,
          price: 35000,
          availableStock: 5,
          photoUrl: m.image_url ?? null,
          badge: "Sur-mesure & Prêt-à-porter",
        }));
      }
    }

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        activityType: company.activity_type,
        plan: company.subscription_plan,
        address: company.address || "Centre-ville",
        city: company.city || "Cotonou",
        country: company.country || "Bénin",
        currency: company.currency || "FCFA",
      },
      products,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Impossible de charger la vitrine." }, { status: 500 });
  }
}
