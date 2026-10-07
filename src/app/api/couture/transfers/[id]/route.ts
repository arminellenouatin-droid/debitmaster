import { NextResponse } from "next/server";
import { getCoutureContext } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { resolveTransferReceiptStatus } from "@/lib/couture-stocks";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const { data: transfer, error: trfErr } = await admin
      .from("couture_transfers")
      .select(`
        *,
        source_site:couture_sites!source_site_id (id, name, site_type),
        destination_site:couture_sites!destination_site_id (id, name, site_type)
      `)
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .single();

    if (trfErr || !transfer) {
      return NextResponse.json({ error: "Transfert introuvable." }, { status: 404 });
    }

    const { data: lines } = await admin
      .from("couture_transfer_lines")
      .select("*")
      .eq("transfer_id", id)
      .eq("tenant_id", context.tenantId);

    return NextResponse.json({
      transfer: {
        ...transfer,
        lines: lines ?? [],
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    const canManageStock =
      context.permissions.has("stock.manage") ||
      context.permissions.has("stock.transfer") ||
      context.permissions.has("supplies.manage");

    if (!canManageStock) {
      return NextResponse.json({ error: "Permission requise pour expédier ou réceptionner un transfert." }, { status: 403 });
    }

    const action = String(body.action || "").toUpperCase(); // "SHIP" | "RECEIVE"
    const admin = createSupabaseAdminClient();

    // 1. Récupérer le transfert existant
    const { data: transfer, error: fetchErr } = await admin
      .from("couture_transfers")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .single();

    if (fetchErr || !transfer) {
      return NextResponse.json({ error: "Transfert introuvable." }, { status: 404 });
    }

    if (action === "SHIP") {
      if (transfer.status !== "DRAFT") {
        return NextResponse.json({ error: "Seul un transfert à l'état brouillon peut être expédié." }, { status: 400 });
      }

      const { data: updatedTransfer, error: shipErr } = await admin
        .from("couture_transfers")
        .update({
          status: "IN_TRANSIT",
          shipped_by: context.user.id,
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("tenant_id", context.tenantId)
        .select()
        .single();

      if (shipErr) {
        return NextResponse.json({ error: "Erreur lors de l'expédition du transfert." }, { status: 500 });
      }

      await writeCoutureAuditEvent({
        tenantId: context.tenantId,
        actorUserId: context.user.id,
        action: "couture.stock.transfer_ship",
        entityType: "couture_transfers",
        entityId: id,
        metadata: { transferNumber: transfer.transfer_number },
      });

      return NextResponse.json({
        success: true,
        transfer: updatedTransfer,
        message: "Transfert expédié (en transit).",
      });
    }

    if (action === "RECEIVE") {
      if (transfer.status !== "IN_TRANSIT") {
        return NextResponse.json({ error: "Seul un transfert en transit peut être réceptionné." }, { status: 400 });
      }

      const { data: lines } = await admin
        .from("couture_transfer_lines")
        .select("*")
        .eq("transfer_id", id)
        .eq("tenant_id", context.tenantId);

      const receivedItemsInput = Array.isArray(body.receivedItems) ? body.receivedItems as Record<string, unknown>[] : [];
      const resolutionList = [];

      for (const line of lines ?? []) {
        const matchingInput = receivedItemsInput.find((it) => it.lineId === line.id);
        const qtyReceived =
          matchingInput && Number.isFinite(Number(matchingInput.quantityReceived))
            ? Number(matchingInput.quantityReceived)
            : Number(line.quantity_shipped);

        const discrepancy = qtyReceived - Number(line.quantity_shipped);

        await admin
          .from("couture_transfer_lines")
          .update({
            quantity_received: qtyReceived,
            discrepancy_quantity: discrepancy,
          })
          .eq("id", line.id);

        resolutionList.push({
          quantityShipped: Number(line.quantity_shipped),
          quantityReceived: qtyReceived,
        });
      }

      const finalStatus = resolveTransferReceiptStatus(resolutionList);

      const { data: updatedTransfer, error: recErr } = await admin
        .from("couture_transfers")
        .update({
          status: finalStatus,
          received_by: context.user.id,
          received_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("tenant_id", context.tenantId)
        .select()
        .single();

      if (recErr) {
        return NextResponse.json({ error: "Erreur lors de la réception du transfert." }, { status: 500 });
      }

      await writeCoutureAuditEvent({
        tenantId: context.tenantId,
        actorUserId: context.user.id,
        action: "couture.stock.transfer_receive",
        entityType: "couture_transfers",
        entityId: id,
        metadata: {
          transferNumber: transfer.transfer_number,
          finalStatus,
        },
      });

      return NextResponse.json({
        success: true,
        transfer: updatedTransfer,
        message:
          finalStatus === "DISCREPANCY"
            ? "Transfert réceptionné avec écart signalé."
            : "Transfert réceptionné conforme sans écart.",
      });
    }

    return NextResponse.json({ error: "Action invalide (SHIP ou RECEIVE attendu)." }, { status: 400 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
