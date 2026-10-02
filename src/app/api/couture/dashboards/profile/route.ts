import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const siteId = searchParams.get("siteId");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "dashboard.view");

    const admin = createSupabaseAdminClient();
    const primaryRole = context.isOwner
      ? "DIRECTEUR_GERANT"
      : context.roles[0]?.role_key || "VENDEUR";

    // 1. Métriques globales (ventes)
    let salesQuery = admin
      .from("couture_sales")
      .select("total_amount, paid_amount, payment_status, sale_type, created_at")
      .eq("tenant_id", context.tenantId);

    if (siteId) salesQuery = salesQuery.eq("site_id", siteId);
    const { data: sales } = await salesQuery;

    const totalSalesXof = (sales ?? []).reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
    const totalPaidXof = (sales ?? []).reduce((acc, s) => acc + (Number(s.paid_amount) || 0), 0);
    const salesCount = (sales ?? []).length;

    // 2. Fiches de production atelier
    let prodQuery = admin
      .from("couture_production_cards")
      .select("id, status, priority, due_date")
      .eq("tenant_id", context.tenantId);

    const { data: prodCards } = await prodQuery;
    const inProgressCardsCount = (prodCards ?? []).filter((c) => c.status === "IN_PROGRESS").length;
    const qcPendingCardsCount = (prodCards ?? []).filter((c) => c.status === "QUALITY_CONTROL").length;
    const urgentCardsCount = (prodCards ?? []).filter((c) => c.priority === "URGENT" || c.priority === "HIGH").length;

    // 3. Demandes d'achat en attente
    const { data: pendingPurchases } = await admin
      .from("couture_purchase_requests")
      .select("id, approval_route, accountant_approval, direction_approval")
      .eq("tenant_id", context.tenantId)
      .eq("status", "SUBMITTED");

    const pendingPurchasesCount = (pendingPurchases ?? []).length;

    // 4. Notifications non lues
    const { count: unreadNotifsCount } = await admin
      .from("couture_notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId)
      .eq("is_read", false);

    // 5. Points du vendeur connecté si profil vendeur
    let mySellerPoints = null;
    if (primaryRole === "VENDEUR" || primaryRole === "CHEF_AGENCE") {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Chercher l'employé lié à l'utilisateur
      const { data: emp } = await admin
        .from("couture_employees")
        .select("id")
        .eq("tenant_id", context.tenantId)
        .eq("user_id", context.user.id)
        .maybeSingle();

      if (emp) {
        const { data: pts } = await admin
          .from("couture_seller_points")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .eq("employee_id", emp.id)
          .eq("period_year", currentYear)
          .eq("period_month", currentMonth)
          .maybeSingle();

        mySellerPoints = pts;
      }
    }

    return NextResponse.json({
      role: primaryRole,
      metrics: {
        totalSalesXof,
        totalPaidXof,
        salesCount,
        inProgressProductionCardsCount: inProgressCardsCount,
        qcPendingCardsCount,
        urgentCardsCount,
        pendingPurchasesCount,
        unreadNotificationsCount: unreadNotifsCount ?? 0,
        mySellerPoints,
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
