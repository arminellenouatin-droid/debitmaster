import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import {
  generateProductionCardNumber,
  buildDefaultProductionSteps,
  type CouturePriority,
} from "@/lib/couture-production";

const validCardTypes = ["COMMANDE", "CONFECTION", "RETOUCHE", "STOCK_MANUFACTURE"] as const;
const validPriorities: CouturePriority[] = ["NORMAL", "URGENT", "VERY_URGENT"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const workshopSiteId = searchParams.get("workshopSiteId");
    const status = searchParams.get("status");
    const currentStep = searchParams.get("currentStep");
    const priority = searchParams.get("priority");
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "production.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_production_cards")
      .select(`
        *,
        couture_customers (id, first_name, last_name, phone),
        workshop:couture_sites!workshop_site_id (id, name, site_type),
        boutique:couture_sites!source_boutique_site_id (id, name, site_type)
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (workshopSiteId) query = query.eq("workshop_site_id", workshopSiteId);
    if (status) query = query.eq("status", status);
    if (currentStep) query = query.eq("current_step", currentStep);
    if (priority && validPriorities.includes(priority as CouturePriority)) query = query.eq("priority", priority);

    const { data: cards, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les fiches de fabrication." }, { status: 500 });
    }

    return NextResponse.json({ cards: cards ?? [] });
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

    assertCouturePermission(context, "production.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const workshopSiteId = typeof body.workshopSiteId === "string" ? body.workshopSiteId.trim() : "";
    const sourceBoutiqueSiteId = typeof body.sourceBoutiqueSiteId === "string" ? body.sourceBoutiqueSiteId.trim() : null;
    const saleId = typeof body.saleId === "string" ? body.saleId.trim() : null;
    const saleLineId = typeof body.saleLineId === "string" ? body.saleLineId.trim() : null;
    const cardType = validCardTypes.includes(body.cardType) ? body.cardType : "COMMANDE";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
    const hasEmbroidery = Boolean(body.hasEmbroidery);
    const embroideryType = hasEmbroidery && ["MAIN", "MACHINE"].includes(body.embroideryType) ? body.embroideryType : "AUCUNE";
    const priority: CouturePriority = validPriorities.includes(body.priority) ? body.priority : "NORMAL";
    const targetDeliveryDate = typeof body.targetDeliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.targetDeliveryDate) ? body.targetDeliveryDate : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() : null;

    if (!workshopSiteId) {
      return NextResponse.json({ error: "Atelier de fabrication requis." }, { status: 400 });
    }
    if (description.length < 2) {
      return NextResponse.json({ error: "Description de pièce requise (au moins 2 caractères)." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Vérifier l'atelier
    const { data: workshopSite } = await admin
      .from("couture_sites")
      .select("id")
      .eq("id", workshopSiteId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

    if (!workshopSite) {
      return NextResponse.json({ error: "Atelier introuvable dans cet établissement." }, { status: 400 });
    }

    // Numéro séquentiel FAB-YYYY-XXXXXX
    const currentYear = new Date().getFullYear();
    const { count } = await admin
      .from("couture_production_cards")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId)
      .like("card_number", `FAB-${currentYear}-%`);

    const sequence = (count ?? 0) + 1;
    const cardNumber = generateProductionCardNumber(sequence, currentYear);

    // Insertion de la fiche
    const { data: createdCard, error: cardErr } = await admin
      .from("couture_production_cards")
      .insert({
        tenant_id: context.tenantId,
        workshop_site_id: workshopSiteId,
        source_boutique_site_id: sourceBoutiqueSiteId,
        sale_id: saleId,
        sale_line_id: saleLineId,
        card_number: cardNumber,
        card_type: cardType,
        customer_id: body.customerId || null,
        customer_name: typeof body.customerName === "string" ? body.customerName.trim().slice(0, 120) : null,
        customer_phone: typeof body.customerPhone === "string" ? body.customerPhone.trim().slice(0, 30) : null,
        measurements_snapshot: body.measurementsSnapshot && typeof body.measurementsSnapshot === "object" ? body.measurementsSnapshot : null,
        model_id: body.modelId || null,
        range_id: body.rangeId || null,
        size_id: body.sizeId || null,
        color_id: body.colorId || null,
        description,
        has_embroidery: hasEmbroidery,
        embroidery_type: embroideryType,
        priority,
        status: "QUEUED",
        current_step: "COUPE",
        target_delivery_date: targetDeliveryDate,
        notes,
        photo_url: photoUrl,
        created_by: context.user.id,
      })
      .select()
      .single();

    if (cardErr || !createdCard) {
      return NextResponse.json({ error: "Impossible de créer la fiche de fabrication." }, { status: 500 });
    }

    // Création automatique de la séquence fixe d'étapes
    const stepDefinitions = buildDefaultProductionSteps(hasEmbroidery);
    const stepsToInsert = stepDefinitions.map((step) => ({
      tenant_id: context.tenantId,
      card_id: createdCard.id,
      step_order: step.stepOrder,
      step_type: step.stepType,
      status: step.stepOrder === 1 ? "PENDING" : "PENDING",
      notes: null,
    }));

    const { data: insertedSteps, error: stepsErr } = await admin
      .from("couture_production_steps")
      .insert(stepsToInsert)
      .select();

    if (stepsErr) {
      // rollback card
      await admin.from("couture_production_cards").delete().eq("id", createdCard.id);
      return NextResponse.json({ error: "Impossible de générer le circuit des étapes de fabrication." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.production.card_create",
      entityType: "couture_production_cards",
      entityId: createdCard.id,
      metadata: {
        cardNumber,
        cardType,
        priority,
        hasEmbroidery,
        workshopSiteId,
      },
    });

    return NextResponse.json(
      {
        card: {
          ...createdCard,
          steps: insertedSteps,
        },
      },
      { status: 201 }
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
