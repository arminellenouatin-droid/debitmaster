// DebitManager Power service sales: service operations never touch product stock.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emitTenantNotification } from "@/lib/notifications";

const allowed = new Set(["GYM", "LAVAGE", "LODGING"]);
const normalize = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function access(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string, activityCode: string, write = false) {
  if (!context.user || !context.tenantIds.includes(tenantId) || !allowed.has(activityCode)) return false;
  if (context.employeeId === null && context.role === "ADMINISTRATEUR") return true;
  return can(context, write ? "payments.create" : "services.view");
}

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    const url = new URL(request.url); const tenantId = url.searchParams.get("tenantId") ?? context.tenantIds[0] ?? ""; const activityCode = url.searchParams.get("activityCode") ?? "GYM";
    if (!await access(context, tenantId, activityCode)) return NextResponse.json({ error: "Accès aux ventes de services refusé." }, { status: 403 });
    const admin = createSupabaseAdminClient();
    const [sales, cash] = await Promise.all([admin.from("power_service_sales").select("id,tenant_id,activity_code,service_id,customer_id,customer_name,room_id,quantity,unit_price_xof,total_amount_xof,payment_method,payment_status,membership_expires_at,duration_minutes,created_by,created_at").eq("tenant_id", tenantId).eq("activity_code", activityCode).order("created_at", { ascending: false }).limit(300), admin.from("power_cash_movements").select("id,activity_code,movement_type,amount_xof,sale_id,note,created_at").eq("tenant_id", tenantId).eq("activity_code", activityCode).order("created_at", { ascending: false }).limit(300)]);
    if (sales.error || cash.error) return NextResponse.json({ error: "Impossible de charger les ventes du service." }, { status: 500 });
    return NextResponse.json({ sales: sales.data ?? [], cash: cash.data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; activityCode?: string; serviceId?: string; customerId?: string; customerName?: string; roomId?: string; lodgingOption?: "PASS" | "NIGHT"; quantity?: number; unitPriceXof?: number; paymentMethod?: string; membershipExpiresAt?: string; durationMinutes?: number };
    const tenantId = normalize(body.tenantId); const activityCode = normalize(body.activityCode).toUpperCase(); const customerName = normalize(body.customerName); const quantity = Number(body.quantity ?? 1); let unitPriceXof = Number(body.unitPriceXof ?? 0); let durationMinutes = Number(body.durationMinutes ?? 0);
    const context = await getAuthorizationContext();
    if (!await access(context, tenantId, activityCode, true)) return NextResponse.json({ error: "Accès à l’encaissement de ce service refusé." }, { status: 403 });
    if (customerName.length < 2 || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(unitPriceXof) || unitPriceXof < 0) return NextResponse.json({ error: "Client, quantité et prix valides requis." }, { status: 400 });
    const admin = createSupabaseAdminClient();
    let room: { id: string; room_number: string; pass_price_xof: number; pass_duration_minutes: number; night_price_xof: number; night_duration_nights: number; occupied_until: string | null } | null = null;
    let previousOccupiedUntil: string | null = null;
    if (activityCode === "LODGING") {
      const option = body.lodgingOption;
      if (!body.roomId || (option !== "PASS" && option !== "NIGHT")) return NextResponse.json({ error: "Chambre et option Nuitée ou Pass requises." }, { status: 400 });
      const { data: roomData, error: roomError } = await admin.from("power_lodging_rooms").select("id,room_number,pass_price_xof,pass_duration_minutes,night_price_xof,night_duration_nights,occupied_until").eq("id", body.roomId).eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
      if (roomError || !roomData) return NextResponse.json({ error: "Chambre introuvable dans cet établissement." }, { status: 400 });
      room = roomData;
      previousOccupiedUntil = room.occupied_until;
      if (room.occupied_until && new Date(room.occupied_until).getTime() > Date.now()) return NextResponse.json({ error: `La chambre ${room.room_number} est occupée jusqu’au ${new Date(room.occupied_until).toLocaleString("fr-FR")}.` }, { status: 409 });
      unitPriceXof = option === "PASS" ? room.pass_price_xof : room.night_price_xof;
      durationMinutes = option === "PASS" ? room.pass_duration_minutes : room.night_duration_nights * 24 * 60;
    }
    if (!Number.isSafeInteger(unitPriceXof) || unitPriceXof < 0 || !Number.isSafeInteger(durationMinutes) || durationMinutes < 0) return NextResponse.json({ error: "Tarif ou durée invalide." }, { status: 400 });
    const occupiedUntil = activityCode === "LODGING" ? new Date(Date.now() + durationMinutes * 60_000).toISOString() : null;
    const { data: sale, error: saleError } = await admin.from("power_service_sales").insert({ tenant_id: tenantId, activity_code: activityCode, service_id: normalize(body.serviceId) || null, customer_id: normalize(body.customerId) || null, customer_name: customerName.slice(0, 160), room_id: room?.id ?? null, quantity, unit_price_xof: unitPriceXof, payment_method: body.paymentMethod === "MOBILE_MONEY" ? "MOBILE_MONEY" : "CASH", payment_status: "PAID", membership_expires_at: body.membershipExpiresAt || null, duration_minutes: durationMinutes || null, created_by: context.user!.id }).select("id,tenant_id,activity_code,service_id,customer_id,customer_name,room_id,quantity,unit_price_xof,total_amount_xof,payment_method,payment_status,membership_expires_at,duration_minutes,created_at").single();
    if (saleError || !sale) return NextResponse.json({ error: "Impossible d’enregistrer la vente du service." }, { status: 400 });
    if (room && occupiedUntil) {
      const { error: roomUpdateError } = await admin.from("power_lodging_rooms").update({ occupied_until: occupiedUntil, updated_at: new Date().toISOString() }).eq("id", room.id).eq("tenant_id", tenantId).is("occupied_until", previousOccupiedUntil);
      if (roomUpdateError) { await admin.from("power_service_sales").delete().eq("id", sale.id).eq("tenant_id", tenantId); return NextResponse.json({ error: "La chambre vient d’être attribuée par un autre opérateur. Réessayez." }, { status: 409 }); }
    }
    const { error: cashError } = await admin.from("power_cash_movements").insert({ tenant_id: tenantId, activity_code: activityCode, sale_id: sale.id, movement_type: "SALE", amount_xof: sale.total_amount_xof, created_by: context.user!.id });
    if (cashError) { await admin.from("power_service_sales").delete().eq("id", sale.id).eq("tenant_id", tenantId); if (room) await admin.from("power_lodging_rooms").update({ occupied_until: previousOccupiedUntil, updated_at: new Date().toISOString() }).eq("id", room.id).eq("tenant_id", tenantId); return NextResponse.json({ error: "Vente enregistrée mais caisse non alimentée. Opération annulée." }, { status: 400 }); }
    await emitTenantNotification({
      tenantId,
      actorUserId: context.user!.id,
      subject: `Nouvelle vente ${activityCode}`,
      body: `${customerName} : ${sale.total_amount_xof.toLocaleString("fr-FR")} XOF encaissés.`,
      eventType: "POWER_SERVICE_SALE_CREATED",
      entityId: sale.id,
      actionPath: `/dashboard/service-sales?activity=${encodeURIComponent(activityCode)}&saleId=${encodeURIComponent(sale.id)}`,
      dedupeKey: `power-sale:${sale.id}`,
      metadata: { activityCode, paymentMethod: sale.payment_method },
    });
    return NextResponse.json({ sale }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
