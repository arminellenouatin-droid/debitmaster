import { NextResponse } from "next/server";
import { getCoutureContext } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import {
  determinePurchaseApprovalRoute,
  generatePurchaseRequestNumber,
} from "@/lib/couture-supplies";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const siteId = searchParams.get("siteId");
    const status = searchParams.get("status");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    const canView =
      context.permissions.has("purchases.view") ||
      context.permissions.has("supplies.view") ||
      context.permissions.has("accounting.view");

    if (!canView) {
      return NextResponse.json({ error: "Permission requise pour consulter les demandes d'achat." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_supply_purchase_requests")
      .select(`
        *,
        supply:couture_supplies!supply_id (id, code, name, unit, category),
        site:couture_sites!site_id (id, name, site_type)
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (siteId) query = query.eq("site_id", siteId);
    if (status) query = query.eq("status", status);

    const { data: requests, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les demandes d'achat." }, { status: 500 });
    }

    return NextResponse.json({ requests: requests ?? [] });
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

    const canRequest =
      context.permissions.has("purchases.request") ||
      context.permissions.has("supplies.request") ||
      context.permissions.has("supplies.manage");

    if (!canRequest) {
      return NextResponse.json({ error: "Permission requise pour créer une demande d'achat." }, { status: 403 });
    }
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const supplyId = typeof body.supplyId === "string" ? body.supplyId.trim() : null;
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : "";
    const quantity = Math.max(0.1, Number(body.quantity) || 1);
    const estimatedCostXof = Math.max(1, Math.floor(Number(body.estimatedCostXof) || 0));

    if (!siteId || description.length < 2) {
      return NextResponse.json({ error: "Atelier et description de fourniture requis." }, { status: 400 });
    }

    // Détermination du circuit à seuil (<50k vs >=50k)
    const approvalRoute = determinePurchaseApprovalRoute(estimatedCostXof);
    const directionApproval = approvalRoute === "THREE_STEP" ? "PENDING" : "NOT_REQUIRED";

    const admin = createSupabaseAdminClient();

    // Numéro séquentiel DA-YYYY-XXXXXX
    const currentYear = new Date().getFullYear();
    const { count } = await admin
      .from("couture_supply_purchase_requests")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId)
      .like("request_number", `DA-${currentYear}-%`);

    const sequence = (count ?? 0) + 1;
    const requestNumber = generatePurchaseRequestNumber(sequence, currentYear);

    const { data: purchaseReq, error } = await admin
      .from("couture_supply_purchase_requests")
      .insert({
        tenant_id: context.tenantId,
        site_id: siteId,
        request_number: requestNumber,
        supply_id: supplyId,
        description,
        quantity,
        estimated_cost_xof: estimatedCostXof,
        approval_route: approvalRoute,
        accountant_approval: "PENDING",
        direction_approval: directionApproval,
        status: "PENDING",
        created_by: context.user.id,
      })
      .select()
      .single();

    if (error || !purchaseReq) {
      return NextResponse.json({ error: "Impossible d'enregistrer la demande d'achat." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.purchase.request_create",
      entityType: "couture_supply_purchase_requests",
      entityId: purchaseReq.id,
      metadata: {
        requestNumber,
        estimatedCostXof,
        approvalRoute,
      },
    });

    return NextResponse.json(
      {
        request: purchaseReq,
        message:
          approvalRoute === "SINGLE_ACCOUNTANT"
            ? "Demande < 50 000 FCFA créée. Validation du comptable seul requise."
            : "Demande ≥ 50 000 FCFA créée. Circuit complet requis (Avis achats -> Comptable -> Direction).",
      },
      { status: 201 }
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
