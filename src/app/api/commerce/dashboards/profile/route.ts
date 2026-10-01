import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? "";
    const requestedProfile = searchParams.get("profile"); // Optional override for manager testing

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const thisMonth = now.toISOString().slice(0, 7);
    const monthStart = `${thisMonth}-01T00:00:00.000Z`;

    // Determine target profile: if manager/admin, allow inspecting any role, otherwise default to active role
    const effectiveProfile = requestedProfile || context.role || "ADMINISTRATEUR";

    const responseData: Record<string, unknown> = {
      profile: effectiveProfile,
      periodMonth: thisMonth,
      generatedAt: now.toISOString(),
    };

    // 1. DATA FOR VENDEUR
    if (["VENDEUR", "ADMINISTRATEUR", "GERANT"].includes(effectiveProfile)) {
      // Find employee ID for current user
      const { data: emp } = await admin
        .from("commerce_employees")
        .select("id, first_name, last_name")
        .eq("tenant_id", tenantId)
        .eq("user_id", context.user.id)
        .maybeSingle();

      const sellerId = emp?.id;

      // Target
      const { data: target } = sellerId ? await admin
        .from("commerce_sales_targets")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("employee_id", sellerId)
        .eq("period_month", thisMonth)
        .maybeSingle() : { data: null };

      // Orders for this month
      let userOrdersQuery = admin
        .from("orders")
        .select("id, total_amount, status, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", monthStart)
        .in("status", ["PAID", "DELIVERED", "COMPLETED", "SERVED"]);

      if (context.role === "VENDEUR") {
        userOrdersQuery = userOrdersQuery.or(`server_user_id.eq.${context.user.id},server_name.ilike.%${context.user.user_metadata?.first_name || ""}%`);
      }

      const { data: userOrders } = await userOrdersQuery;

      let todaySales = 0;
      let monthSales = 0;
      for (const ord of userOrders ?? []) {
        const amt = Number(ord.total_amount) || 0;
        monthSales += amt;
        if (new Date(ord.created_at) >= new Date(todayStart)) {
          todaySales += amt;
        }
      }

      const targetRevenue = target ? Number(target.target_revenue_xof) : 0;
      const ratePercent = target ? Number(target.commission_rate_percent) : 0;
      const achievementPercent = targetRevenue > 0 ? Number(((monthSales / targetRevenue) * 100).toFixed(1)) : 0;
      const estimatedCommission = Math.round(monthSales * (ratePercent / 100));

      // Pending quotes
      const { count: pendingQuotesCount } = await admin
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["PENDING", "DRAFT"]);

      // Unpaid invoices
      const { count: pendingInvoicesCount } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["PENDING", "PREPARED", "CONFIRMED"]);

      responseData.vendeur = {
        todaySales,
        monthSales,
        targetRevenue,
        achievementPercent,
        estimatedCommission,
        commissionRatePercent: ratePercent,
        pendingQuotesCount: pendingQuotesCount ?? 0,
        pendingInvoicesCount: pendingInvoicesCount ?? 0,
      };
    }

    // 2. DATA FOR CAISSIER
    if (["CAISSIER", "ADMINISTRATEUR", "GERANT"].includes(effectiveProfile)) {
      // Pending orders queue to cash in
      const { data: queue } = await admin
        .from("orders")
        .select("id, order_number, invoice_number, total_amount, server_name, table_label, created_at, status")
        .eq("tenant_id", tenantId)
        .in("status", ["PENDING", "CONFIRMED"])
        .order("created_at", { ascending: false })
        .limit(10);

      // Collections today
      const { data: todayPaid } = await admin
        .from("orders")
        .select("id, total_amount, currency, updated_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", todayStart)
        .in("status", ["PAID", "DELIVERED", "COMPLETED"]);

      const totalCollectedToday = (todayPaid ?? []).reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);

      // Active cash register session
      const { data: activeSession } = await admin
        .from("commerce_cash_sessions")
        .select("id, session_number, register_name, opened_at, opening_balance_xof, status")
        .eq("tenant_id", tenantId)
        .eq("status", "OPEN")
        .maybeSingle();

      responseData.caissier = {
        pendingInvoicesQueue: queue ?? [],
        queueCount: queue?.length ?? 0,
        totalCollectedToday,
        activeSession: activeSession ?? null,
      };
    }

    // 3. DATA FOR MAGASINIER
    if (["MAGASINIER", "ADMINISTRATEUR", "GERANT"].includes(effectiveProfile)) {
      // Deliveries waiting to prepare/dispatch
      const { data: deliveriesToPrepare } = await admin
        .from("delivery_notes")
        .select("id, delivery_number, invoice_number, customer_name, status, created_at")
        .eq("tenant_id", tenantId)
        .in("status", ["DRAFT", "PREPARING"])
        .limit(10);

      // Goods receipts waiting
      const { data: pendingReceipts } = await admin
        .from("goods_receipts")
        .select("id, receipt_number, po_number, supplier_name, status, created_at")
        .eq("tenant_id", tenantId)
        .eq("status", "PENDING")
        .limit(10);

      // Low stock count in store
      const { data: lowStockProducts } = await admin
        .from("commerce_products")
        .select("id, name, min_stock")
        .eq("tenant_id", tenantId)
        .gt("min_stock", 0)
        .limit(5);

      responseData.magasinier = {
        deliveriesToPrepare: deliveriesToPrepare ?? [],
        deliveriesCount: deliveriesToPrepare?.length ?? 0,
        pendingReceipts: pendingReceipts ?? [],
        receiptsCount: pendingReceipts?.length ?? 0,
        lowStockProducts: lowStockProducts ?? [],
      };
    }

    // 4. DATA FOR APPROVISIONNEMENT
    if (["APPROVISIONNEMENT", "ADMINISTRATEUR", "GERANT"].includes(effectiveProfile)) {
      // Reorder suggestions (products with min_stock > 0)
      const { data: reorderList } = await admin
        .from("commerce_products")
        .select("id, name, internal_code, min_stock, reorder_point, purchase_price_xof")
        .eq("tenant_id", tenantId)
        .gt("min_stock", 0)
        .limit(10);

      // Purchase orders in progress
      const { data: ongoingPOs } = await admin
        .from("purchase_orders")
        .select("id, order_number, supplier_name, total_amount_xof, status, expected_delivery_date")
        .eq("tenant_id", tenantId)
        .in("status", ["PENDING", "APPROVED", "PARTIALLY_RECEIVED"])
        .order("created_at", { ascending: false })
        .limit(10);

      responseData.approvisionnement = {
        reorderSuggestions: reorderList ?? [],
        ongoingPOs: ongoingPOs ?? [],
        ongoingCount: ongoingPOs?.length ?? 0,
      };
    }

    // 5. DATA FOR INVENTAIRE
    if (["INVENTAIRE", "ADMINISTRATEUR", "GERANT"].includes(effectiveProfile)) {
      const { data: activeSessions } = await admin
        .from("inventory_sessions")
        .select("id, session_number, name, inventory_type, status, total_variance_amount_xof, created_at")
        .eq("tenant_id", tenantId)
        .in("status", ["DRAFT", "IN_PROGRESS", "COUNTING", "RECOUNTING"])
        .order("created_at", { ascending: false })
        .limit(5);

      responseData.inventaire = {
        activeSessions: activeSessions ?? [],
        hasOngoingSession: (activeSessions?.length ?? 0) > 0,
      };
    }

    // 6. DATA FOR COMPTABLE
    if (["COMPTABLE", "ADMINISTRATEUR", "GERANT"].includes(effectiveProfile)) {
      const { data: recentEntries } = await admin
        .from("commerce_journal_entries")
        .select("id, entry_number, entry_date, journal_code, total_debit_xof, total_credit_xof, is_balanced, status")
        .eq("tenant_id", tenantId)
        .order("entry_date", { ascending: false })
        .limit(10);

      const allBalanced = (recentEntries ?? []).every((e) => e.is_balanced);

      responseData.comptable = {
        recentEntries: recentEntries ?? [],
        allBalanced,
        recentCount: recentEntries?.length ?? 0,
      };
    }

    // 7. DATA FOR PROPRIETAIRE / GERANT (Executive Overview)
    if (["ADMINISTRATEUR", "GERANT"].includes(effectiveProfile)) {
      // Today revenue
      const { data: todayOrders } = await admin
        .from("orders")
        .select("total_amount")
        .eq("tenant_id", tenantId)
        .gte("created_at", todayStart)
        .in("status", ["PAID", "DELIVERED", "COMPLETED"]);

      const todayRevenue = (todayOrders ?? []).reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);

      // Month revenue
      const { data: monthOrders } = await admin
        .from("orders")
        .select("total_amount")
        .eq("tenant_id", tenantId)
        .gte("created_at", monthStart)
        .in("status", ["PAID", "DELIVERED", "COMPLETED"]);

      const monthRevenue = (monthOrders ?? []).reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);

      // Available treasury
      const { data: treasuryAccounts } = await admin
        .from("commerce_treasury_accounts")
        .select("account_type, current_balance_xof")
        .eq("tenant_id", tenantId)
        .eq("status", "ACTIVE");

      let totalCash = 0;
      let totalBank = 0;
      let totalMoMo = 0;

      for (const acc of treasuryAccounts ?? []) {
        const bal = Number(acc.current_balance_xof) || 0;
        if (acc.account_type === "CASH") totalCash += bal;
        else if (acc.account_type === "BANK") totalBank += bal;
        else if (acc.account_type === "MOBILE_MONEY") totalMoMo += bal;
      }

      // Pending approvals
      const { count: pendingExpensesCount } = await admin
        .from("commerce_expenses")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "PENDING_APPROVAL");

      const { count: pendingPOCount } = await admin
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "PENDING");

      responseData.executive = {
        todayRevenue,
        monthRevenue,
        treasury: {
          total: totalCash + totalBank + totalMoMo,
          cash: totalCash,
          bank: totalBank,
          mobileMoney: totalMoMo,
        },
        pendingApprovals: {
          expenses: pendingExpensesCount ?? 0,
          purchaseOrders: pendingPOCount ?? 0,
          total: (pendingExpensesCount ?? 0) + (pendingPOCount ?? 0),
        },
      };
    }

    return NextResponse.json(responseData);
  } catch (err) {
    console.error("[dashboards/profile] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}
