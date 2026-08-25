// DebitManager stock API: lecture et mouvements bornés par les établissements possédés par la session.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

const movementTypes = ["IN_PURCHASE", "OUT_SALE", "OUT_LOSS", "OUT_BREAKAGE", "OUT_EXPIRY", "ADJUSTMENT"] as const;

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter le stock." }, { status: 403 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    let query = supabase.from("products").select("id,tenant_id,name,product_type,unit,price,stock_family,current_stock,alert_threshold,safety_threshold").is("deleted_at", null).order("name").limit(100);
    if (tenantId) query = query.eq("tenant_id", tenantId); else query = query.in("tenant_id", tenantIds);
    if (context.role === "MAGASINIER" && context.employeeId) {
      const { data: employee } = await supabase.from("employees").select("stock_scope").eq("id", context.employeeId).maybeSingle();
      if (employee?.stock_scope === "BEVERAGE" || employee?.stock_scope === "KITCHEN") query = query.eq("stock_family", employee.stock_scope);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger le stock." }, { status: 500 });
    const productIds = (data ?? []).map((product) => product.id);
    const { data: purchases, error: purchaseError } = productIds.length
      ? await supabase.from("stock_purchases").select("product_id,purchase_unit_price,quantity").in("product_id", productIds).order("purchased_at", { ascending: true }).limit(2000)
      : { data: [], error: null };
    if (purchaseError) return NextResponse.json({ error: "Impossible de calculer la valeur d’achat du stock." }, { status: 500 });
    const purchaseTotals = new Map<string, { quantity: number; value: number }>();
    for (const purchase of purchases ?? []) {
      const current = purchaseTotals.get(purchase.product_id) ?? { quantity: 0, value: 0 };
      purchaseTotals.set(purchase.product_id, { quantity: current.quantity + Number(purchase.quantity ?? 0), value: current.value + Number(purchase.quantity ?? 0) * Number(purchase.purchase_unit_price ?? 0) });
    }
    const valuedStock = (data ?? []).map((product) => {
      const totals = purchaseTotals.get(product.id);
      if (!totals?.quantity) return { ...product, weighted_purchase_price: null, stock_value: null };
      const weightedPurchasePrice = Math.round(totals.value / totals.quantity);
      return { ...product, weighted_purchase_price: weightedPurchasePrice, stock_value: Math.round(Number(product.current_stock ?? 0) * weightedPurchasePrice) };
    });
    let movementQuery = supabase.from("stock_movements").select("id,tenant_id,product_id,movement_type,quantity,reason,destination,created_at,products(name,unit,stock_family)").order("created_at", { ascending: false }).limit(20);
    movementQuery = tenantId ? movementQuery.eq("tenant_id", tenantId) : movementQuery.in("tenant_id", tenantIds);
    const { data: movements, error: movementError } = await movementQuery;
    if (movementError) return NextResponse.json({ error: "Impossible de charger les mouvements de stock." }, { status: 500 });
    return NextResponse.json({ stock: valuedStock, movements: movements ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    const movementType = typeof body.movementType === "string" ? body.movementType : "";
    const quantity = Number(body.quantity);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 240) : null;
    const destination = typeof body.destination === "string" ? body.destination : null;
    if (!tenantId || !productId || !movementTypes.includes(movementType as (typeof movementTypes)[number]) || !Number.isInteger(quantity) || quantity <= 0) return NextResponse.json({ error: "Produit, type de mouvement et quantité positive requis." }, { status: 400 });
    if (movementType === "OUT_SALE" && destination !== "BAR" && destination !== "CUISINE") return NextResponse.json({ error: "Une sortie doit être destinée au bar ou à la cuisine." }, { status: 400 });
    if (movementType !== "OUT_SALE" && destination !== null) return NextResponse.json({ error: "La destination ne s’applique qu’aux sorties vers le bar ou la cuisine." }, { status: 400 });
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (context.role === "MAGASINIER" && movementType === "OUT_SALE") return NextResponse.json({ error: "Le Magasinier doit envoyer une livraison au Gérant via le Magasin comptoir." }, { status: 403 });
    const requiredPermission = movementType === "IN_PURCHASE" ? "stock.receive" : movementType === "OUT_SALE" ? "stock.issue" : "stock.adjust";
    if (!can(context, requiredPermission)) return NextResponse.json({ error: "Permission insuffisante pour ce mouvement de stock." }, { status: 403 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data: product } = await supabase.from("products").select("id,current_stock,stock_family").eq("id", productId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle();
    if (!product) return NextResponse.json({ error: "Produit non autorisé." }, { status: 403 });
    if (context.role === "MAGASINIER" && context.employeeId) {
      const { data: employee } = await supabase.from("employees").select("stock_scope").eq("id", context.employeeId).maybeSingle();
      if (employee?.stock_scope !== "BOTH" && employee?.stock_scope !== product.stock_family) return NextResponse.json({ error: "Ce produit est hors du périmètre de stock attribué." }, { status: 403 });
    }
    const signedQuantity = movementType === "IN_PURCHASE" || movementType === "ADJUSTMENT" ? quantity : -quantity;
    if (product.current_stock + signedQuantity < 0) return NextResponse.json({ error: "Stock insuffisant pour ce mouvement." }, { status: 400 });
    const { data: movement, error: movementError } = await supabase.from("stock_movements").insert({ tenant_id: tenantId, product_id: productId, movement_type: movementType, quantity: signedQuantity, reason, destination, responsible_user_id: user.id }).select("id,tenant_id,product_id,movement_type,quantity,reason,destination,created_at").single();
    if (movementError) return NextResponse.json({ error: "Impossible d’enregistrer le mouvement." }, { status: 400 });
    const { error: productError } = await supabase.from("products").update({ current_stock: product.current_stock + signedQuantity, updated_at: new Date().toISOString() }).eq("id", productId).eq("tenant_id", tenantId);
    if (productError) return NextResponse.json({ error: "Mouvement enregistré mais mise à jour du stock incomplète. Vérifiez ce produit." }, { status: 500 });
    return NextResponse.json({ movement, currentStock: product.current_stock + signedQuantity }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
