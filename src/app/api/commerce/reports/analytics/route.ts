import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? "";
    const range = searchParams.get("range") ?? "30d"; // 'today', '7d', '30d', 'this_month', 'custom'
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");
    const storeId = searchParams.get("storeId");

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    if (!can(context, "reports.view") && !can(context, "reports.analytics")) {
      return NextResponse.json({ error: "Permission insuffisante pour consulter les rapports." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const now = new Date();

    // Determine start and end timestamps
    let startDate: Date;
    let endDate = new Date(now.getTime() + 24 * 3600 * 1000);

    if (range === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (range === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    } else if (range === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (range === "custom" && customStart) {
      startDate = new Date(customStart);
      if (customEnd) endDate = new Date(customEnd);
    } else {
      // 30d default
      startDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    }

    // 1. Fetch valid orders in range
    let ordersQuery = admin
      .from("orders")
      .select(`
        id, order_number, invoice_number, total_amount, discount_amount, tax_amount,
        server_user_id, server_name, table_label, status, created_at,
        order_items (id, product_id, product_name, quantity, unit_price, total_price)
      `)
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .in("status", ["PAID", "DELIVERED", "COMPLETED", "SERVED"]);

    const { data: orders, error: ordersErr } = await ordersQuery;
    if (ordersErr) {
      console.error("[reports/analytics] orders fetch error", ordersErr);
      return NextResponse.json({ error: "Impossible de charger les données d'analyse." }, { status: 500 });
    }

    // 2. Fetch products to get CMP (weighted_avg_cost_xof) & categories
    const { data: products } = await admin
      .from("commerce_products")
      .select("id, name, category_id, weighted_avg_cost_xof, purchase_price_xof, price_retail_xof")
      .eq("tenant_id", tenantId);

    const productMap = new Map((products ?? []).map((p) => [p.id, p]));

    // Fetch categories
    const { data: categories } = await admin
      .from("commerce_categories")
      .select("id, name")
      .eq("tenant_id", tenantId);

    const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]));

    // 3. Compute Aggregations
    let totalRevenue = 0;
    let totalCmp = 0;
    const dayMap = new Map<string, { date: string; revenue: number; orders: number }>();
    const sellerMap = new Map<string, { sellerName: string; revenue: number; orders: number }>();
    const categoryRevenueMap = new Map<string, number>();
    const productStatsMap = new Map<string, { productId: string; name: string; quantity: number; revenue: number; cmp: number }>();

    for (const order of orders ?? []) {
      const revenue = Number(order.total_amount) || 0;
      totalRevenue += revenue;

      // Group by day (YYYY-MM-DD)
      const dateKey = new Date(order.created_at).toISOString().slice(0, 10);
      const dayData = dayMap.get(dateKey) ?? { date: dateKey, revenue: 0, orders: 0 };
      dayData.revenue += revenue;
      dayData.orders += 1;
      dayMap.set(dateKey, dayData);

      // Group by salesperson
      const seller = order.server_name || "Vendeur général";
      const sellerData = sellerMap.get(seller) ?? { sellerName: seller, revenue: 0, orders: 0 };
      sellerData.revenue += revenue;
      sellerData.orders += 1;
      sellerMap.set(seller, sellerData);

      // Process order items for CMP, category and product metrics
      for (const item of order.order_items ?? []) {
        const qty = Number(item.quantity) || 1;
        const itemRev = Number(item.total_price) || 0;
        const prod = item.product_id ? productMap.get(item.product_id) : null;

        const cost = prod
          ? (Number(prod.weighted_avg_cost_xof) || Number(prod.purchase_price_xof) || Math.round(itemRev * 0.70))
          : Math.round(itemRev * 0.70);

        const itemTotalCmp = cost * qty;
        totalCmp += itemTotalCmp;

        // Category
        const catName = (prod && prod.category_id && categoryMap.get(prod.category_id)) || "Divers & Général";
        categoryRevenueMap.set(catName, (categoryRevenueMap.get(catName) ?? 0) + itemRev);

        // Product stats
        const pKey = item.product_id ?? item.product_name;
        const pStat = productStatsMap.get(pKey) ?? {
          productId: pKey,
          name: item.product_name,
          quantity: 0,
          revenue: 0,
          cmp: 0,
        };
        pStat.quantity += qty;
        pStat.revenue += itemRev;
        pStat.cmp += itemTotalCmp;
        productStatsMap.set(pKey, pStat);
      }
    }

    const orderCount = orders?.length ?? 0;
    const averageBasket = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
    const grossProfit = totalRevenue - totalCmp;
    const grossMarginPercent = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0;

    // 4. ABC Pareto Analysis on products
    const productList = Array.from(productStatsMap.values()).sort((a, b) => b.revenue - a.revenue);
    let runningRevenue = 0;
    const abcAnalysis = productList.map((p) => {
      runningRevenue += p.revenue;
      const cumPercent = totalRevenue > 0 ? (runningRevenue / totalRevenue) * 100 : 0;
      let classification: "A" | "B" | "C" = "C";
      if (cumPercent <= 80 || (runningRevenue - p.revenue) === 0) {
        classification = "A";
      } else if (cumPercent <= 95) {
        classification = "B";
      } else {
        classification = "C";
      }
      return {
        ...p,
        grossMargin: p.revenue - p.cmp,
        marginPercent: p.revenue > 0 ? Number((((p.revenue - p.cmp) / p.revenue) * 100).toFixed(2)) : 0,
        cumulativePercent: Number(cumPercent.toFixed(1)),
        classification,
      };
    });

    // 5. Aged Receivables (unpaid orders)
    const { data: unpaidOrders } = await admin
      .from("orders")
      .select("id, total_amount, created_at, status")
      .eq("tenant_id", tenantId)
      .in("status", ["PENDING", "PREPARED", "CONFIRMED"]);

    let receivablesUnder30 = 0;
    let receivables30To60 = 0;
    let receivablesOver60 = 0;

    for (const u of unpaidOrders ?? []) {
      const amt = Number(u.total_amount) || 0;
      const ageDays = (now.getTime() - new Date(u.created_at).getTime()) / (1000 * 3600 * 24);
      if (ageDays <= 30) receivablesUnder30 += amt;
      else if (ageDays <= 60) receivables30To60 += amt;
      else receivablesOver60 += amt;
    }

    // 6. Aged Payables (unpaid purchase orders)
    const { data: unpaidPOs } = await admin
      .from("purchase_orders")
      .select("id, total_amount_xof, created_at, status")
      .eq("tenant_id", tenantId)
      .in("status", ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"]);

    let payablesUnder30 = 0;
    let payables30To60 = 0;
    let payablesOver60 = 0;

    for (const po of unpaidPOs ?? []) {
      const amt = Number(po.total_amount_xof) || 0;
      const ageDays = (now.getTime() - new Date(po.created_at).getTime()) / (1000 * 3600 * 24);
      if (ageDays <= 30) payablesUnder30 += amt;
      else if (ageDays <= 60) payables30To60 += amt;
      else payablesOver60 += amt;
    }

    // 7. Sort series for graphs
    const byDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const bySalesperson = Array.from(sellerMap.values())
      .map((s) => ({
        ...s,
        percentage: totalRevenue > 0 ? Number(((s.revenue / totalRevenue) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const byCategory = Array.from(categoryRevenueMap.entries())
      .map(([categoryName, revenue]) => ({
        categoryName,
        revenue,
        percentage: totalRevenue > 0 ? Number(((revenue / totalRevenue) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      range,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      metrics: {
        totalRevenue,
        totalCmp,
        grossProfit,
        grossMarginPercent,
        orderCount,
        averageBasket,
      },
      byDay,
      bySalesperson,
      byCategory,
      topProducts: abcAnalysis.slice(0, 10),
      abcAnalysis,
      agedReceivables: {
        total: receivablesUnder30 + receivables30To60 + receivablesOver60,
        under30Days: receivablesUnder30,
        between30And60Days: receivables30To60,
        over60Days: receivablesOver60,
      },
      agedPayables: {
        total: payablesUnder30 + payables30To60 + payablesOver60,
        under30Days: payablesUnder30,
        between30And60Days: payables30To60,
        over60Days: payablesOver60,
      },
    });
  } catch (err) {
    console.error("[reports/analytics] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}
