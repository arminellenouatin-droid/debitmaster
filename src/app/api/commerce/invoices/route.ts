// DebitMaster Commerce API: listing et création directe de factures de vente
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

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("orders")
      .select(`
        id, tenant_id, order_number, invoice_number, document_type, table_label,
        server_name, status, total_amount, currency, created_at, updated_at,
        server_user_id, customer_id, discount_amount, tax_amount, quote_id,
        customers (id, full_name, phone)
      `)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status) query = query.eq("status", status);
    if (search) query = query.or(`order_number.ilike.%${search}%,table_label.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Impossible de charger les factures." }, { status: 500 });
    }

    return NextResponse.json({ invoices: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const customerId = typeof body.customerId === "string" && body.customerId ? body.customerId : null;
    const customerName = typeof body.customerName === "string" && body.customerName.trim() ? body.customerName.trim() : "Client comptoir";
    const documentType = body.documentType === "PROFORMA" ? "PROFORMA" : "INVOICE";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!tenantId || items.length === 0) {
      return NextResponse.json({ error: "Un établissement et au moins un article sont requis." }, { status: 400 });
    }

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }
    if (!can(context, "orders.create")) {
      return NextResponse.json({ error: "Permission insuffisante pour créer une vente." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Numéro séquentiel
    const year = new Date().getFullYear();
    let invoiceNumber = "";
    try {
      const { data: numData } = await admin.rpc("next_document_number", {
        p_tenant_id: tenantId,
        p_doc_type: documentType === "PROFORMA" ? "PROFORMA" : "INVOICE",
      });
      if (numData) invoiceNumber = String(numData);
    } catch {
      // Fallback
    }

    if (!invoiceNumber) {
      const { count } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      const seq = (count ?? 0) + 1;
      const prefix = documentType === "PROFORMA" ? "PRO" : "FAC";
      invoiceNumber = `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
    }

    // 2. Vérification des articles & calculs
    const productIds = items.map((i: { productId: string }) => i.productId).filter(Boolean);
    const { data: dbProducts } = await admin
      .from("products")
      .select("id, name, price, unit")
      .eq("tenant_id", tenantId)
      .in("id", productIds);

    const productMap = new Map((dbProducts ?? []).map((p) => [p.id, p]));

    let subtotalAmount = 0;
    let totalDiscountAmount = 0;
    let totalTaxAmount = 0;

    const validatedItems: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }> = [];

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
        unit_price: unitPrice,
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

    // 3. Créer la commande / facture
    const { data: createdOrder, error: orderError } = await admin
      .from("orders")
      .insert({
        tenant_id: tenantId,
        order_number: invoiceNumber,
        invoice_number: invoiceNumber,
        document_type: documentType,
        table_label: customerName ? `Client: ${customerName}` : "Vente comptoir",
        server_name: sellerName,
        server_user_id: context.user.id,
        customer_id: customerId,
        total_amount: totalAmount,
        currency: "XOF",
        status: "PENDING", // À régler en caisse
        discount_amount: totalDiscountAmount,
        tax_amount: totalTaxAmount,
      })
      .select()
      .single();

    if (orderError || !createdOrder) {
      return NextResponse.json({ error: orderError?.message || "Impossible de créer la facture." }, { status: 400 });
    }

    // 4. Lignes de vente
    const orderItems = validatedItems.map((vi) => ({
      tenant_id: tenantId,
      order_id: createdOrder.id,
      product_id: vi.product_id,
      product_name: vi.product_name,
      quantity: vi.quantity,
      unit_price: vi.unit_price,
      total_price: vi.total_price,
      fulfillment_unit: "COUNTER",
      preparation_status: "PENDING",
    }));

    const { data: insertedItems } = await admin.from("order_items").insert(orderItems).select();

    // 5. Réservation immédiate du stock
    if (insertedItems && insertedItems.length > 0) {
      const allocations = insertedItems.map((item) => ({
        tenant_id: tenantId,
        order_id: createdOrder.id,
        order_item_id: item.id,
        product_id: item.product_id,
        server_user_id: context.user.id,
        quantity: item.quantity,
        status: "ALLOCATED",
      }));
      await admin.from("order_stock_allocations").insert(allocations);
    }

    return NextResponse.json({
      invoice: {
        ...createdOrder,
        items: validatedItems,
      },
      message: `Facture ${invoiceNumber} créée et transmise en caisse.`,
    }, { status: 201 });
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
