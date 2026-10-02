import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import {
  generateCoutureTransferNumber,
  type CoutureTransferType,
} from "@/lib/couture-stocks";

const validTransferTypes: CoutureTransferType[] = [
  "ATELIER_TO_BOUTIQUE",
  "BOUTIQUE_TO_BOUTIQUE",
  "BOUTIQUE_TO_ATELIER",
  "ATELIER_TO_ATELIER",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const sourceSiteId = searchParams.get("sourceSiteId");
    const destinationSiteId = searchParams.get("destinationSiteId");
    const status = searchParams.get("status");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "stock.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_transfers")
      .select(`
        *,
        source_site:couture_sites!source_site_id (id, name, site_type),
        destination_site:couture_sites!destination_site_id (id, name, site_type)
      `)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (sourceSiteId) query = query.eq("source_site_id", sourceSiteId);
    if (destinationSiteId) query = query.eq("destination_site_id", destinationSiteId);
    if (status) query = query.eq("status", status);

    const { data: transfers, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les transferts." }, { status: 500 });
    }

    return NextResponse.json({ transfers: transfers ?? [] });
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

    assertCouturePermission(context, "stock.transfer");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const sourceSiteId = typeof body.sourceSiteId === "string" ? body.sourceSiteId.trim() : "";
    const destinationSiteId = typeof body.destinationSiteId === "string" ? body.destinationSiteId.trim() : "";
    const transferType: CoutureTransferType = validTransferTypes.includes(body.transferType)
      ? body.transferType
      : "BOUTIQUE_TO_BOUTIQUE";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!sourceSiteId || !destinationSiteId) {
      return NextResponse.json({ error: "Sites source et destination requis." }, { status: 400 });
    }
    if (sourceSiteId === destinationSiteId) {
      return NextResponse.json({ error: "Le site source et le site de destination doivent être distincts." }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Le transfert doit comporter au moins un article." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Numéro séquentiel TRF-YYYY-XXXXXX
    const currentYear = new Date().getFullYear();
    const { count } = await admin
      .from("couture_transfers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId)
      .like("transfer_number", `TRF-${currentYear}-%`);

    const sequence = (count ?? 0) + 1;
    const transferNumber = generateCoutureTransferNumber(sequence, currentYear);

    // Insertion du transfert
    const { data: createdTransfer, error: trfErr } = await admin
      .from("couture_transfers")
      .insert({
        tenant_id: context.tenantId,
        transfer_number: transferNumber,
        transfer_type: transferType,
        source_site_id: sourceSiteId,
        destination_site_id: destinationSiteId,
        status: "DRAFT",
        notes,
      })
      .select()
      .single();

    if (trfErr || !createdTransfer) {
      return NextResponse.json({ error: "Impossible de créer le transfert." }, { status: 500 });
    }

    // Insertion des lignes
    const linesToInsert = items.map((it: any) => ({
      tenant_id: context.tenantId,
      transfer_id: createdTransfer.id,
      item_type: ["CLOTHING", "ACCESSORY", "SUPPLY"].includes(it.itemType) ? it.itemType : "CLOTHING",
      model_id: it.modelId || null,
      range_id: it.rangeId || null,
      size_id: it.sizeId || null,
      color_id: it.colorId || null,
      accessory_id: it.accessoryId || null,
      supply_id: it.supplyId || null,
      description: typeof it.description === "string" ? it.description.trim().slice(0, 240) : "Article de transfert",
      quantity_shipped: Math.max(0.1, Number(it.quantityShipped) || 1),
      quantity_received: 0,
      discrepancy_quantity: 0,
    }));

    const { error: linesErr } = await admin.from("couture_transfer_lines").insert(linesToInsert);
    if (linesErr) {
      await admin.from("couture_transfers").delete().eq("id", createdTransfer.id);
      return NextResponse.json({ error: "Impossible d'enregistrer les articles du transfert." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.stock.transfer_create",
      entityType: "couture_transfers",
      entityId: createdTransfer.id,
      metadata: {
        transferNumber,
        sourceSiteId,
        destinationSiteId,
        itemsCount: items.length,
      },
    });

    return NextResponse.json(
      {
        transfer: {
          ...createdTransfer,
          lines: linesToInsert,
        },
      },
      { status: 201 }
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
