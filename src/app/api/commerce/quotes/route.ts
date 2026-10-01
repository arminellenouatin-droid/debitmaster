// DebitMaster Commerce API: gestion sécurisée des devis et proformas multi-tenant
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? "";
    const status = searchParams.get("status") ?? "";
    const search = searchParams.get("search")?.trim().slice(0, 80) ?? "";

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }
    if (!can(context, "quotes.view") && !can(context, "orders.view")) {
      return NextResponse.json({ error: "Permission insuffisante pour consulter les devis." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("quotes")
      .select(`
        id, tenant_id, quote_number, quote_type, customer_id, customer_name, customer_phone,
        seller_user_id, seller_name, store_id, status, valid_until,
        subtotal_amount, tax_amount, discount_amount, total_amount, currency,
        notes, terms, converted_order_id, converted_at, created_at, updated_at
      `)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status) query = query.eq("status", status);
    if (search) query = query.or(`quote_number.ilike.%${search}%,customer_name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) {
      // Si la table n'est pas encore créée en base, renvoyer une réponse propre
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({ quotes: [], tableMissing: true });
      }
      return NextResponse.json({ error: "Impossible de charger les devis." }, { status: 500 });
    }

    return NextResponse.json({ quotes: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const quoteType = body.quoteType === "PROFORMA" ? "PROFORMA" : "STANDARD";
    const customerId = typeof body.customerId === "string" && body.customerId ? body.customerId : null;
    const customerName = typeof body.customerName === "string" && body.customerName.trim() ? body.customerName.trim() : "Client comptoir";
    const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : null;
    const storeId = typeof body.storeId === "string" && body.storeId ? body.storeId : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null;
    const terms = typeof body.terms === "string" ? body.terms.trim().slice(0, 500) : null;
    const validDays = Number(body.validDays) > 0 ? Number(body.validDays) : 15;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!tenantId || items.length === 0) {
      return NextResponse.json({ error: "Un établissement et au moins un article sont requis." }, { status: 400 });
    }

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }
    if (!can(context, "quotes.create") && !can(context, "orders.create")) {
      return NextResponse.json({ error: "Permission insuffisante pour créer un devis." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Générer le numéro séquentiel unique
    const year = new Date().getFullYear();
    const prefix = quoteType === "PROFORMA" ? "PRO" : "DEV";
    
    // Essayer d'utiliser la fonction RPC atomique, sinon fallback déterministe
    let quoteNumber = "";
    try {
      const { data: numData } = await admin.rpc("next_document_number", {
        p_tenant_id: tenantId,
        p_doc_type: quoteType === "PROFORMA" ? "PROFORMA" : "QUOTE",
      });
      if (numData) quoteNumber = String(numData);
    } catch {
      // Fallback
    }

    if (!quoteNumber) {
      const { count } = await admin
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      const seq = (count ?? 0) + 1;
      quoteNumber = `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
    }

    // 2. Calculer les montants côté serveur
    let subtotalAmount = 0;
    let totalDiscountAmount = 0;
    let totalTaxAmount = 0;

    const validatedItems: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit: string;
      unit_price: number;
      discount_percent: number;
      tax_rate: number;
      total_price: number;
    }> = [];

    // Récupérer les produits pour valider les prix
    const productIds = items.map((i: { productId: string }) => i.productId).filter(Boolean);
    const { data: dbProducts } = await admin
      .from("products")
      .select("id, name, price, unit")
      .eq("tenant_id", tenantId)
      .in("id", productIds);

    const productMap = new Map((dbProducts ?? []).map((p) => [p.id, p]));

    for (const item of items) {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) continue;

      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(dbProduct.price) || 0;
      const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
      const taxRate = Math.max(0, Number(item.taxRate) || 0);

      const lineGross = quantity * unitPrice;
      const lineDiscount = Math.round(lineGross * (discountPercent / 100));
      const lineNet = lineGross - lineDiscount;
      const lineTax = Math.round(lineNet * (taxRate / 100));
      const lineTotal = lineNet + lineTax;

      subtotalAmount += lineGross;
      totalDiscountAmount += lineDiscount;
      totalTaxAmount += lineTax;

      validatedItems.push({
        product_id: dbProduct.id,
        product_name: dbProduct.name,
        quantity,
        unit: dbProduct.unit || "unité",
        unit_price: unitPrice,
        discount_percent: discountPercent,
        tax_rate: taxRate,
        total_price: lineTotal,
      });
    }

    if (validatedItems.length === 0) {
      return NextResponse.json({ error: "Aucun article valide trouvé." }, { status: 400 });
    }

    const totalAmount = subtotalAmount - totalDiscountAmount + totalTaxAmount;
    const sellerName = [context.user.user_metadata?.first_name, context.user.user_metadata?.last_name]
      .filter(Boolean)
      .join(" ") || "Vendeur";

    const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();

    // 3. Insérer le devis
    const { data: createdQuote, error: insertError } = await admin
      .from("quotes")
      .insert({
        tenant_id: tenantId,
        quote_number: quoteNumber,
        quote_type: quoteType,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        seller_user_id: context.user.id,
        seller_name: sellerName,
        store_id: storeId,
        status: "PENDING",
        valid_until: validUntil,
        subtotal_amount: subtotalAmount,
        discount_amount: totalDiscountAmount,
        tax_amount: totalTaxAmount,
        total_amount: totalAmount,
        currency: "XOF",
        notes,
        terms,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message || "Impossible d'enregistrer le devis." }, { status: 400 });
    }

    // 4. Insérer les lignes de devis
    const itemsToInsert = validatedItems.map((item) => ({
      tenant_id: tenantId,
      quote_id: createdQuote.id,
      ...item,
    }));

    const { error: itemsError } = await admin.from("quote_items").insert(itemsToInsert);
    if (itemsError) {
      console.error("[DebitMaster] Error inserting quote items:", itemsError);
    }

    return NextResponse.json({
      quote: {
        ...createdQuote,
        items: validatedItems,
      },
    }, { status: 201 });
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
