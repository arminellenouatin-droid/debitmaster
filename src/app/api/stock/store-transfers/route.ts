// DebitManager store transfers API: l'envoi réserve, la réception confirmée débite et crédite atomiquement.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { emitTenantNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les transferts." }, { status: 403 });
    if (tenantId && !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    let query = context.supabase.from("store_transfers").select("id,tenant_id,source_store_id,destination_store_id,sent_by,recipient_user_id,status,notes,sent_at,received_at,received_by,inventory_stores!store_transfers_source_store_id_fkey(name),store_transfer_items(id,product_id,quantity,products(name,unit,stock_family))").order("sent_at", { ascending: false }).limit(100);
    query = tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", context.tenantIds);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les transferts." }, { status: 500 });
    return NextResponse.json({ transfers: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const sourceStoreId = typeof body.sourceStoreId === "string" ? body.sourceStoreId : "";
    const destinationStoreId = typeof body.destinationStoreId === "string" ? body.destinationStoreId : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    const quantity = Number(body.quantity);
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 240) : null;
    if (!tenantId || !sourceStoreId || !destinationStoreId || !productId || !Number.isInteger(quantity) || quantity <= 0) return NextResponse.json({ error: "Magasins, produit et quantité positive requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.handoff")) return NextResponse.json({ error: "Permission insuffisante pour envoyer une livraison." }, { status: 403 });
    if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await context.supabase.rpc("create_store_transfer", { p_tenant_id: tenantId, p_source_store_id: sourceStoreId, p_destination_store_id: destinationStoreId, p_product_id: productId, p_quantity: quantity, p_notes: notes });
    if (error) return NextResponse.json({ error: "Impossible d’envoyer la livraison. Vérifiez le magasin source et le stock disponible." }, { status: 400 });
    const transferId = typeof data === "string" ? data : data?.id;
    await emitTenantNotification({ tenantId, actorUserId: context.user.id, subject: "Transfert de stock à réceptionner", body: "Une livraison est arrivée au magasin comptoir et attend votre confirmation.", eventType: "STORE_TRANSFER_SENT", entityId: transferId ?? null, actionPath: "/dashboard/stock?tab=transfers", actionPermission: "stock.accept_counter", operatorPositions: ["GERANT"], dedupeKey: transferId ? `store-transfer-sent:${transferId}` : null });
    return NextResponse.json({ transfer: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const transferId = typeof body.transferId === "string" ? body.transferId : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    if (!transferId || !tenantId) return NextResponse.json({ error: "Établissement et transfert requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    if (!can(context, "stock.accept_counter")) return NextResponse.json({ error: "Seul le Gérant autorisé peut confirmer cette réception." }, { status: 403 });
    const { data, error } = await context.supabase.rpc("receive_store_transfer", { p_transfer_id: transferId });
    if (error) return NextResponse.json({ error: "Impossible de confirmer la réception. Le transfert a peut-être déjà été traité." }, { status: 400 });
    await emitTenantNotification({ tenantId, actorUserId: context.user.id, subject: "Transfert de stock réceptionné", body: "Le Gérant a confirmé la réception d’un transfert vers le magasin comptoir.", eventType: "STORE_TRANSFER_RECEIVED", entityId: transferId, actionPath: "/dashboard/stock?tab=transfers", actionPermission: "stock.view", operatorPositions: ["MAGASINIER"], dedupeKey: `store-transfer-received:${transferId}` });
    return NextResponse.json({ transfer: data });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
