import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ownerOnly = (context: Awaited<ReturnType<typeof getAuthorizationContext>>) => context.role === "ADMINISTRATEUR" && context.employeeId === null;
const inventoryRole = (context: Awaited<ReturnType<typeof getAuthorizationContext>>) => context.role === "INVENTAIRE" || context.role === "RESPONSABLE_INVENTAIRE";

export async function GET(request: NextRequest) {
  const context = await getAuthorizationContext();
  if (!context.user || !context.tenantIds.length) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const db = createSupabaseAdminClient();
  const tenantId = request.nextUrl.searchParams.get("tenantId") || context.tenantIds[0];
  if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
  const { data, error } = await db.from("inventory_audits").select("id,tenant_id,title,scope,inventory_type,status,counted_at,submitted_at,validated_at,validated_by,closed_at,created_by,note,created_at,updated_at,inventory_audit_items(id,product_id,theoretical_quantity,physical_quantity,unit_cost,variance_quantity,variance_value,cause,justification,counted_by,counted_at,products(id,name,unit,stock_family))").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Impossible de charger les inventaires." }, { status: 500 });
  return NextResponse.json({ audits: data ?? [] });
}

export async function POST(request: NextRequest) {
  const context = await getAuthorizationContext();
  if (!context.user || !context.tenantIds.length) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const db = createSupabaseAdminClient();
  const body = await request.json().catch(() => null) as { tenantId?: string; action?: string; auditId?: string; title?: string; scope?: string; inventoryType?: string; note?: string; items?: Array<{ productId: string; theoreticalQuantity: number; physicalQuantity: number; unitCost: number; cause?: string; justification?: string }> } | null;
  if (!body || !body.tenantId || !context.tenantIds.includes(body.tenantId)) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const tenantId = body.tenantId;
  const action = body.action ?? "CREATE";
  if (action === "CREATE") {
    if (!inventoryRole(context) && !ownerOnly(context)) return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    const { data: audit, error } = await db.from("inventory_audits").insert({ tenant_id: tenantId, title: body.title?.trim() || `Inventaire du ${new Intl.DateTimeFormat("fr-FR").format(new Date())}`, scope: body.scope || "ALL_STOCK", inventory_type: body.inventoryType || "FULL", created_by: context.user.id, note: body.note?.trim() || null }).select("id,title,status,counted_at").single();
    if (error) {
      console.error("[inventory-audits.CREATE] database error", { code: error.code, message: error.message });
      return NextResponse.json({ error: "Impossible de créer la session d’inventaire.", diagnostic: "INVENTORY_SESSION_CREATE_FAILED" }, { status: 500 });
    }
    return NextResponse.json({ audit }, { status: 201 });
  }
  if (!body.auditId) return NextResponse.json({ error: "Session d’inventaire manquante." }, { status: 400 });
  const { data: audit, error: auditError } = await db.from("inventory_audits").select("id,status,tenant_id").eq("id", body.auditId).eq("tenant_id", tenantId).maybeSingle();
  if (auditError || !audit) return NextResponse.json({ error: "Inventaire introuvable." }, { status: 404 });
  if (action === "SAVE_ITEMS") {
    if (!inventoryRole(context) || audit.status !== "DRAFT") return NextResponse.json({ error: "Le comptage est verrouillé ou votre rôle ne permet pas cette action." }, { status: 403 });
    const rawItems = body.items ?? [];
    const productIds = [...new Set(rawItems.map((item) => item.productId).filter(Boolean))];
    if (!productIds.length) return NextResponse.json({ error: "Ajoutez au moins une ligne de comptage." }, { status: 400 });
    const { data: products } = await db.from("products").select("id").eq("tenant_id", tenantId).in("id", productIds).is("deleted_at", null).limit(5000);
    const allowedProductIds = new Set((products ?? []).map((product) => product.id));
    if (allowedProductIds.size !== productIds.length) return NextResponse.json({ error: "Un produit de l’inventaire n’appartient pas à cet établissement." }, { status: 400 });
    const items = rawItems.map((item) => ({ audit_id: audit.id, tenant_id: tenantId, product_id: item.productId, theoretical_quantity: Math.max(0, Math.round(Number(item.theoreticalQuantity))), physical_quantity: Math.max(0, Math.round(Number(item.physicalQuantity))), unit_cost: Math.max(0, Math.round(Number(item.unitCost))), cause: item.cause?.trim() || null, justification: item.justification?.trim() || null, counted_by: context.user.id, counted_at: new Date().toISOString() }));
    const { error } = await db.from("inventory_audit_items").upsert(items, { onConflict: "audit_id,product_id" });
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer le comptage." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === "SUBMIT") {
    if (!inventoryRole(context) || audit.status !== "DRAFT") return NextResponse.json({ error: "Seul un inventaire en brouillon peut être soumis." }, { status: 403 });
    const { data: items } = await db.from("inventory_audit_items").select("physical_quantity,theoretical_quantity,justification,unit_cost").eq("audit_id", audit.id).limit(5000);
    if (!items?.length) return NextResponse.json({ error: "Ajoutez au moins une ligne de comptage avant la soumission." }, { status: 400 });
    const unjustified = items.some((item) => Math.abs(Number(item.physical_quantity) - Number(item.theoretical_quantity)) > 0 && !item.justification);
    if (unjustified) return NextResponse.json({ error: "Chaque écart doit être justifié avant la soumission." }, { status: 400 });
    const { error } = await db.from("inventory_audits").update({ status: "SUBMITTED", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", audit.id).eq("status", "DRAFT");
    if (error) return NextResponse.json({ error: "Impossible de soumettre l’inventaire." }, { status: 500 });
    return NextResponse.json({ ok: true, status: "SUBMITTED" });
  }
  if (action === "APPROVE" || action === "CLOSE") {
    if (!ownerOnly(context)) return NextResponse.json({ error: "Seul le Propriétaire peut valider ou clôturer un inventaire." }, { status: 403 });
    if (action === "APPROVE" && audit.status !== "SUBMITTED") return NextResponse.json({ error: "Seul un inventaire soumis peut être validé." }, { status: 400 });
    if (action === "CLOSE" && audit.status !== "APPROVED") return NextResponse.json({ error: "L’inventaire doit être validé avant clôture." }, { status: 400 });
    const patch = action === "APPROVE" ? { status: "APPROVED", validated_at: new Date().toISOString(), validated_by: context.user.id, updated_at: new Date().toISOString() } : { status: "CLOSED", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { error } = await db.from("inventory_audits").update(patch).eq("id", audit.id);
    if (error) return NextResponse.json({ error: "Impossible de mettre à jour le statut de l’inventaire." }, { status: 500 });
    return NextResponse.json({ ok: true, status: patch.status });
  }
  return NextResponse.json({ error: "Action d’inventaire inconnue." }, { status: 400 });
}
