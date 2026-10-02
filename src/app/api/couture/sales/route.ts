import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import {
  generateCoutureSaleNumber,
  calculateLineTotal,
  calculateSaleTotals,
  resolvePaymentStatus,
  type CoutureSaleType,
  type CoutureSaleItemType,
  type CouturePaymentMethod,
} from "@/lib/couture-sales";

const validSaleTypes: CoutureSaleType[] = ["VENTE_SIMPLE", "COMMANDE", "CONFECTION", "RETOUCHE"];
const validItemTypes: CoutureSaleItemType[] = ["CLOTHING", "ACCESSORY", "CONFECTION_LABOR", "ALTERATION_SERVICE"];
const validPaymentMethods: CouturePaymentMethod[] = ["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const siteId = searchParams.get("siteId");
    const saleType = searchParams.get("saleType");
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sales.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_sales")
      .select(`
        id,
        tenant_id,
        site_id,
        sale_number,
        sale_type,
        customer_id,
        status,
        subtotal_amount_xof,
        discount_amount_xof,
        total_amount_xof,
        paid_amount_xof,
        balance_amount_xof,
        delivery_deadline,
        notes,
        created_by,
        created_at,
        updated_at,
        couture_customers (id, first_name, last_name, phone)
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (siteId) query = query.eq("site_id", siteId);
    if (saleType && validSaleTypes.includes(saleType as CoutureSaleType)) query = query.eq("sale_type", saleType);
    if (status) query = query.eq("status", status);
    if (customerId) query = query.eq("customer_id", customerId);

    const { data: sales, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les ventes." }, { status: 500 });
    }

    return NextResponse.json({ sales: sales ?? [] });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sales.create");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const saleType: CoutureSaleType = validSaleTypes.includes(body.saleType) ? body.saleType : "VENTE_SIMPLE";
    const customerId = typeof body.customerId === "string" && body.customerId ? body.customerId.trim() : null;
    const deliveryDeadline = typeof body.deliveryDeadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.deliveryDeadline) ? body.deliveryDeadline : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    const discountAmountXof = Math.max(0, Math.floor(Number(body.discountAmountXof) || 0));

    if (!siteId) {
      return NextResponse.json({ error: "Site boutique requis." }, { status: 400 });
    }

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: "La vente doit comporter au moins une ligne." }, { status: 400 });
    }

    // Validation et calcul des lignes
    const sanitizedLines = [];
    for (const rawLine of body.lines) {
      const itemType: CoutureSaleItemType = validItemTypes.includes(rawLine.itemType) ? rawLine.itemType : "CLOTHING";
      const description = typeof rawLine.description === "string" ? rawLine.description.trim().slice(0, 240) : "";
      if (description.length < 2) {
        return NextResponse.json({ error: "Description d'article invalide (min 2 caractères)." }, { status: 400 });
      }

      const quantity = Math.max(1, Math.floor(Number(rawLine.quantity) || 1));
      const unitPriceXof = Math.max(0, Math.floor(Number(rawLine.unitPriceXof) || 0));
      const totalPriceXof = calculateLineTotal(quantity, unitPriceXof);

      const isChild = Boolean(rawLine.isChild);
      const modelId = typeof rawLine.modelId === "string" && rawLine.modelId ? rawLine.modelId : null;
      const rangeId = typeof rawLine.rangeId === "string" && rawLine.rangeId ? rawLine.rangeId : null;
      const sizeId = typeof rawLine.sizeId === "string" && rawLine.sizeId ? rawLine.sizeId : null;
      const colorId = typeof rawLine.colorId === "string" && rawLine.colorId ? rawLine.colorId : null;
      const accessoryId = typeof rawLine.accessoryId === "string" && rawLine.accessoryId ? rawLine.accessoryId : null;
      const measurementsSnapshot = rawLine.measurementsSnapshot && typeof rawLine.measurementsSnapshot === "object" ? rawLine.measurementsSnapshot : null;
      const fabricProvidedByCustomer = Boolean(rawLine.fabricProvidedByCustomer || saleType === "CONFECTION");
      const alterationNotes = typeof rawLine.alterationNotes === "string" ? rawLine.alterationNotes.trim().slice(0, 1000) : null;

      sanitizedLines.push({
        itemType,
        modelId,
        rangeId,
        sizeId,
        colorId,
        accessoryId,
        description,
        isChild,
        quantity,
        unitPriceXof,
        totalPriceXof,
        measurementsSnapshot,
        fabricProvidedByCustomer,
        alterationNotes,
      });
    }

    const totals = calculateSaleTotals(
      sanitizedLines.map((l) => ({ quantity: l.quantity, unitPriceXof: l.unitPriceXof })),
      discountAmountXof,
      0
    );

    const admin = createSupabaseAdminClient();

    // Vérifier l'appartenance du site à ce tenant
    const { data: site, error: siteErr } = await admin
      .from("couture_sites")
      .select("id")
      .eq("id", siteId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

    if (siteErr || !site) {
      return NextResponse.json({ error: "Site non trouvé dans cet établissement." }, { status: 400 });
    }

    // Génération du numéro séquentiel
    const currentYear = new Date().getFullYear();
    const { count, error: countErr } = await admin
      .from("couture_sales")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId)
      .like("sale_number", `VTE-${currentYear}-%`);

    const sequence = (count ?? 0) + 1;
    const saleNumber = generateCoutureSaleNumber(sequence, currentYear);

    // Initial payment
    let initialPaymentAmount = 0;
    let initialPaymentMethod: CouturePaymentMethod | null = null;
    let initialPaymentRef: string | null = null;

    if (body.initialPayment && typeof body.initialPayment === "object") {
      const pAmount = Math.max(0, Math.floor(Number(body.initialPayment.amountXof) || 0));
      if (pAmount > 0) {
        initialPaymentAmount = Math.min(pAmount, totals.totalAmountXof);
        initialPaymentMethod = validPaymentMethods.includes(body.initialPayment.paymentMethod)
          ? body.initialPayment.paymentMethod
          : "CASH";
        initialPaymentRef = typeof body.initialPayment.reference === "string"
          ? body.initialPayment.reference.trim().slice(0, 120)
          : null;
      }
    }

    const status = resolvePaymentStatus(totals.totalAmountXof, initialPaymentAmount);
    const balanceAmountXof = Math.max(0, totals.totalAmountXof - initialPaymentAmount);

    // Insertion de la vente
    const { data: createdSale, error: saleErr } = await admin
      .from("couture_sales")
      .insert({
        tenant_id: context.tenantId,
        site_id: siteId,
        sale_number: saleNumber,
        sale_type: saleType,
        customer_id: customerId,
        status,
        subtotal_amount_xof: totals.subtotalAmountXof,
        discount_amount_xof: totals.discountAmountXof,
        total_amount_xof: totals.totalAmountXof,
        paid_amount_xof: initialPaymentAmount,
        balance_amount_xof: balanceAmountXof,
        delivery_deadline: deliveryDeadline,
        notes,
        created_by: context.user.id,
      })
      .select()
      .single();

    if (saleErr || !createdSale) {
      return NextResponse.json({ error: "Impossible d'enregistrer la vente." }, { status: 500 });
    }

    // Insertion des lignes
    const linesToInsert = sanitizedLines.map((l) => ({
      tenant_id: context.tenantId,
      sale_id: createdSale.id,
      item_type: l.itemType,
      model_id: l.modelId,
      range_id: l.rangeId,
      size_id: l.sizeId,
      color_id: l.colorId,
      accessory_id: l.accessoryId,
      description: l.description,
      is_child: l.isChild,
      quantity: l.quantity,
      unit_price_xof: l.unitPriceXof,
      total_price_xof: l.totalPriceXof,
      measurements_snapshot: l.measurementsSnapshot,
      fabric_provided_by_customer: l.fabricProvidedByCustomer,
      alteration_notes: l.alterationNotes,
    }));

    const { error: linesErr } = await admin.from("couture_sale_lines").insert(linesToInsert);
    if (linesErr) {
      // rollback sale
      await admin.from("couture_sales").delete().eq("id", createdSale.id);
      return NextResponse.json({ error: "Impossible d'enregistrer les articles de la vente." }, { status: 500 });
    }

    // Insertion de l'acompte/règlement initial si présent
    if (initialPaymentAmount > 0 && initialPaymentMethod) {
      await admin.from("couture_sale_payments").insert({
        tenant_id: context.tenantId,
        sale_id: createdSale.id,
        site_id: siteId,
        payment_method: initialPaymentMethod,
        amount_xof: initialPaymentAmount,
        reference: initialPaymentRef,
        received_by: context.user.id,
      });
    }

    // Journal d'audit
    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.sale.create",
      entityType: "couture_sales",
      entityId: createdSale.id,
      metadata: {
        saleNumber,
        saleType,
        totalAmountXof: totals.totalAmountXof,
        paidAmountXof: initialPaymentAmount,
        status,
      },
    });

    return NextResponse.json(
      {
        sale: {
          ...createdSale,
          lines: sanitizedLines,
        },
      },
      { status: 201 }
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
