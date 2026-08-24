// DebitManager supply requests: demandes stock limitées à l’établissement et au rôle autorisé.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

const destinations = ["BAR", "CUISINE"] as const;

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les demandes." }, { status: 403 });
    if (tenantId && !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    let query = context.supabase.from("supply_requests").select("id,tenant_id,product_id,requested_by,quantity,destination,status,notes,reviewed_at,fulfilled_at,created_at,products(name,unit,stock_family)").order("created_at", { ascending: false }).limit(100);
    query = tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", context.tenantIds);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les demandes d’approvisionnement." }, { status: 500 });
    return NextResponse.json({ requests: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    const quantity = Number(body.quantity);
    const destination = typeof body.destination === "string" ? body.destination : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 240) : null;
    if (!tenantId || !productId || !Number.isInteger(quantity) || quantity <= 0 || (destination !== null && !destinations.includes(destination as (typeof destinations)[number]))) return NextResponse.json({ error: "Produit, quantité positive et destination valide requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "stock.receive")) return NextResponse.json({ error: "Permission insuffisante pour demander un approvisionnement." }, { status: 403 });
    if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data: product } = await context.supabase.from("products").select("id,stock_family").eq("id", productId).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle();
    if (!product) return NextResponse.json({ error: "Produit non autorisé." }, { status: 403 });
    if (context.role === "MAGASINIER" && context.employeeId) {
      const { data: employee } = await context.supabase.from("employees").select("stock_scope").eq("id", context.employeeId).maybeSingle();
      if (employee?.stock_scope !== "BOTH" && employee?.stock_scope !== product.stock_family) return NextResponse.json({ error: "Ce produit est hors du périmètre de stock attribué." }, { status: 403 });
    }
    const { data, error } = await context.supabase.from("supply_requests").insert({ tenant_id: tenantId, product_id: productId, requested_by: context.user.id, quantity, destination, notes }).select("id,tenant_id,product_id,quantity,destination,status,notes,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer la demande d’approvisionnement." }, { status: 400 });
    return NextResponse.json({ request: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
