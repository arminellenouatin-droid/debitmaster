// DebitManager daily control API: le superviseur valide une clôture par établissement et par date.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId) || !can(context, "stock.audit")) return NextResponse.json({ error: "Permission insuffisante pour consulter le contrôle journalier." }, { status: 403 });
    const { data, error } = await context.supabase.from("daily_stock_controls").select("id,tenant_id,business_date,supervisor_id,actual_sales_xof,closing_stock_snapshot,checked_magasinier_id,status,notes,validated_at,created_at,updated_at").eq("tenant_id", tenantId).order("business_date", { ascending: false }).limit(30);
    if (error) return NextResponse.json({ error: "Impossible de charger les contrôles journaliers." }, { status: 500 });
    return NextResponse.json({ controls: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const businessDate = typeof body.businessDate === "string" ? body.businessDate : "";
    const actualSalesXof = Number(body.actualSalesXof);
    const closingStockSnapshot = body.closingStockSnapshot && typeof body.closingStockSnapshot === "object" ? body.closingStockSnapshot : {};
    const checkedMagasinierId = typeof body.checkedMagasinierId === "string" ? body.checkedMagasinierId : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null;
    if (!tenantId || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate) || !Number.isInteger(actualSalesXof) || actualSalesXof < 0) return NextResponse.json({ error: "Établissement, date et ventes réelles valides requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "reports.daily_close")) return NextResponse.json({ error: "Seul le superviseur autorisé peut enregistrer un contrôle journalier." }, { status: 403 });
    const { data, error } = await context.supabase.from("daily_stock_controls").upsert({ tenant_id: tenantId, business_date: businessDate, supervisor_id: context.user.id, actual_sales_xof: actualSalesXof, closing_stock_snapshot: closingStockSnapshot, checked_magasinier_id: checkedMagasinierId, status: "OPEN", notes }).select("id,tenant_id,business_date,actual_sales_xof,closing_stock_snapshot,checked_magasinier_id,status,notes,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer le contrôle journalier." }, { status: 400 });
    return NextResponse.json({ control: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const controlId = typeof body.controlId === "string" ? body.controlId : "";
    const status = body.status === "VALIDATED" || body.status === "DISCREPANCY" ? body.status : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : undefined;
    if (!tenantId || !controlId || !status) return NextResponse.json({ error: "Contrôle et état valides requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user || !context.tenantIds.includes(tenantId) || !can(context, "reports.daily_close")) return NextResponse.json({ error: "Permission insuffisante pour valider le contrôle." }, { status: 403 });
    const patch = { status, ...(notes === undefined ? {} : { notes }), validated_at: new Date().toISOString() };
    const { data, error } = await context.supabase.from("daily_stock_controls").update(patch).eq("id", controlId).eq("tenant_id", tenantId).eq("status", "OPEN").select("id,status,notes,validated_at").single();
    if (error || !data) return NextResponse.json({ error: "Contrôle introuvable ou déjà clôturé." }, { status: 409 });
    return NextResponse.json({ control: data });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
