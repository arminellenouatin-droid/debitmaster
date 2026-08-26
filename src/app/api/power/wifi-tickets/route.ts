// DebitManager Power: Gérant WIFI ticket ledger, always tenant-scoped.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CATALOG = [
  { ticket_code: "3_HOURS", label: "Ticket 3 heures", duration_label: "3 heures", unit_price_xof: 100 },
  { ticket_code: "72_HOURS", label: "Ticket 72 heures", duration_label: "72 heures", unit_price_xof: 500 },
  { ticket_code: "1_MONTH", label: "Ticket 1 mois", duration_label: "1 mois", unit_price_xof: 2500 },
] as const;
async function allowed(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string) {
  if (!context.user || !tenantId || !context.tenantIds.includes(tenantId) || (!can(context, "services.view") && !can(context, "finance.view"))) return false;
  const { data: company } = await context.supabase.from("companies").select("activity_type").eq("id", tenantId).maybeSingle();
  return company?.activity_type === "POWER";
}

export async function GET(request: Request) {
  const context = await getAuthorizationContext();
  const tenantId = new URL(request.url).searchParams.get("tenantId") ?? context.tenantIds[0] ?? "";
  if (!await allowed(context, tenantId)) return NextResponse.json({ error: "Accès WIFI refusé." }, { status: 403 });
  const admin = createSupabaseAdminClient();
  const [{ data: inventory, error: inventoryError }, { data: sales, error: salesError }] = await Promise.all([
    admin.from("power_wifi_ticket_inventory").select("id,tenant_id,ticket_code,label,duration_label,unit_price_xof,received_quantity,sold_quantity,updated_at").eq("tenant_id", tenantId).order("unit_price_xof").limit(10),
    admin.from("power_wifi_ticket_sales").select("id,ticket_code,quantity,unit_price_xof,total_amount_xof,customer_name,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (inventoryError || salesError) return NextResponse.json({ error: "Impossible de charger les tickets WIFI." }, { status: 500 });
  const rows = CATALOG.map((item) => ({ ...item, ...(inventory?.find((row) => row.ticket_code === item.ticket_code) ?? { received_quantity: 0, sold_quantity: 0 }) }));
  return NextResponse.json({ inventory: rows, sales: sales ?? [] });
}

export async function POST(request: Request) {
  const context = await getAuthorizationContext();
  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : context.tenantIds[0] ?? "";
  if (!await allowed(context, tenantId)) return NextResponse.json({ error: "Accès WIFI refusé." }, { status: 403 });
  const ticketCode = typeof body.ticketCode === "string" ? body.ticketCode : "";
  const item = CATALOG.find((entry) => entry.ticket_code === ticketCode);
  const quantity = Number(body.quantity);
  if (!item || !Number.isInteger(quantity) || quantity <= 0) return NextResponse.json({ error: "Type de ticket ou quantité invalide." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (body.action === "RECEIVE") {
    if (!can(context, "finance.view")) return NextResponse.json({ error: "Permission insuffisante pour enregistrer une réception WIFI." }, { status: 403 });
    const { data: current } = await admin.from("power_wifi_ticket_inventory").select("received_quantity,sold_quantity").eq("tenant_id", tenantId).eq("ticket_code", item.ticket_code).maybeSingle();
    const { error } = await admin.from("power_wifi_ticket_inventory").upsert({ tenant_id: tenantId, ticket_code: item.ticket_code, label: item.label, duration_label: item.duration_label, unit_price_xof: item.unit_price_xof, received_quantity: Number(current?.received_quantity ?? 0) + quantity, sold_quantity: Number(current?.sold_quantity ?? 0), updated_by: context.user!.id, updated_at: new Date().toISOString() }, { onConflict: "tenant_id,ticket_code" });
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer les tickets reçus." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (!can(context, "payments.create")) return NextResponse.json({ error: "Permission insuffisante pour enregistrer une vente WIFI." }, { status: 403 });
  const { data: current } = await admin.from("power_wifi_ticket_inventory").select("received_quantity,sold_quantity").eq("tenant_id", tenantId).eq("ticket_code", item.ticket_code).maybeSingle();
  const received = Number(current?.received_quantity ?? 0); const sold = Number(current?.sold_quantity ?? 0);
  if (sold + quantity > received) return NextResponse.json({ error: "Stock de tickets WIFI insuffisant." }, { status: 409 });
  const customerName = typeof body.customerName === "string" ? body.customerName.trim().slice(0, 160) || null : null;
  const { data: sale, error: saleError } = await admin.from("power_wifi_ticket_sales").insert({ tenant_id: tenantId, ticket_code: item.ticket_code, quantity, unit_price_xof: item.unit_price_xof, customer_name: customerName, created_by: context.user!.id }).select("id,ticket_code,quantity,unit_price_xof,total_amount_xof,customer_name,created_at").single();
  if (saleError) return NextResponse.json({ error: "Impossible d’enregistrer la vente WIFI." }, { status: 500 });
  const { error: updateError } = await admin.from("power_wifi_ticket_inventory").update({ sold_quantity: sold + quantity, updated_by: context.user!.id, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("ticket_code", item.ticket_code).eq("sold_quantity", sold);
  if (updateError) return NextResponse.json({ error: "Vente enregistrée mais stock WIFI à réconcilier." }, { status: 409 });
  const { error: cashError } = await admin.from("power_cash_movements").insert({ tenant_id: tenantId, activity_code: "WIFI", sale_id: sale.id, movement_type: "SALE", amount_xof: sale.total_amount_xof, note: customerName ? `Ticket WIFI — ${customerName}` : "Ticket WIFI", created_by: context.user!.id });
  if (cashError) return NextResponse.json({ error: "Vente enregistrée mais mouvement de caisse WIFI à réconcilier." }, { status: 409 });
  return NextResponse.json({ sale });
}
