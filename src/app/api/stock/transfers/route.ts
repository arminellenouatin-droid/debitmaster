// DebitManager stock handoff API: transferts bornés par tenant, famille de stock et rôle destinataire.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

const recipientRoles = ["GERANT", "CHEF_CUISINE", "SERVEUR"] as const;
const stockFamilies = ["BEVERAGE", "KITCHEN"] as const;

type TransferItem = { productId: string; quantity: number };

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les remises." }, { status: 403 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await context.supabase.from("stock_transfers").select("id,tenant_id,stock_family,source_user_id,recipient_user_id,recipient_role,transfer_date,status,items,notes,received_at,received_by,distributed_at,distributed_by,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Impossible de charger les remises de stock." }, { status: 500 });
    return NextResponse.json({ transfers: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const stockFamily = typeof body.stockFamily === "string" ? body.stockFamily : "";
    const recipientRole = typeof body.recipientRole === "string" ? body.recipientRole : "";
    const recipientUserId = typeof body.recipientUserId === "string" ? body.recipientUserId : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 240) : null;
    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
    const items: TransferItem[] = rawItems.filter((item: unknown): item is TransferItem => Boolean(item && typeof item === "object" && typeof (item as TransferItem).productId === "string" && Number.isInteger((item as TransferItem).quantity) && (item as TransferItem).quantity > 0));
    if (!tenantId || !stockFamilies.includes(stockFamily as (typeof stockFamilies)[number]) || !recipientRoles.includes(recipientRole as (typeof recipientRoles)[number]) || !items.length) return NextResponse.json({ error: "Établissement, famille, destinataire et lignes de stock valides requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "stock.handoff")) return NextResponse.json({ error: "Permission insuffisante pour préparer cette remise." }, { status: 403 });
    if (context.role === "MAGASINIER" && recipientRole !== "GERANT") return NextResponse.json({ error: "Le magasinier remet les stocks au gérant." }, { status: 403 });
    if (context.role === "GERANT" && recipientRole !== "SERVEUR" && recipientRole !== "CHEF_CUISINE") return NextResponse.json({ error: "Le gérant distribue les stocks aux équipes opérationnelles." }, { status: 403 });
    const productIds = items.map((item) => item.productId);
    const { data: products, error: productsError } = await context.supabase.from("products").select("id,stock_family,current_stock").eq("tenant_id", tenantId).in("id", productIds).is("deleted_at", null).limit(100);
    if (productsError || !products || products.length !== productIds.length || products.some((product) => product.stock_family !== stockFamily)) return NextResponse.json({ error: "Un produit est absent ou appartient à une autre famille de stock." }, { status: 400 });
    const { data, error } = await context.supabase.from("stock_transfers").insert({ tenant_id: tenantId, stock_family: stockFamily, source_user_id: context.user.id, recipient_user_id: recipientUserId, recipient_role: recipientRole, items, notes }).select("id,tenant_id,stock_family,source_user_id,recipient_user_id,recipient_role,transfer_date,status,items,notes,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer la remise de stock." }, { status: 400 });
    return NextResponse.json({ transfer: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const transferId = typeof body.transferId === "string" ? body.transferId : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const action = body.action === "receive" ? "RECEIVED" : body.action === "distribute" ? "DISTRIBUTED" : "";
    if (!transferId || !tenantId || !action) return NextResponse.json({ error: "Remise et action valides requises." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const permission = action === "RECEIVED" ? (can(context, "stock.accept_kitchen") || can(context, "stock.handoff")) : can(context, "stock.handoff");
    if (!permission) return NextResponse.json({ error: "Permission insuffisante pour cette étape." }, { status: 403 });
    const patch = action === "RECEIVED" ? { status: action, received_at: new Date().toISOString(), received_by: context.user.id } : { status: action, distributed_at: new Date().toISOString(), distributed_by: context.user.id };
    const { data, error } = await context.supabase.from("stock_transfers").update(patch).eq("id", transferId).eq("tenant_id", tenantId).in("status", action === "RECEIVED" ? ["PREPARED"] : ["RECEIVED"]).select("id,status,received_at,received_by,distributed_at,distributed_by").single();
    if (error || !data) return NextResponse.json({ error: "Remise introuvable ou transition invalide." }, { status: 409 });
    return NextResponse.json({ transfer: data });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
