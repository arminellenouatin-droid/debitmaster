// DebitManager Power Auberge: chambres et tarifs, strictement limités au domaine LODGING.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const normalize = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 40) : "";
function allowed(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string, write = false) {
  if (!context.user || !context.tenantIds.includes(tenantId)) return false;
  return write ? can(context, "services.manage") : can(context, "services.view") || can(context, "finance.view");
}

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!allowed(context, tenantId)) return NextResponse.json({ error: "Accès aux chambres refusé." }, { status: 403 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("power_lodging_rooms").select("id,tenant_id,room_number,pass_price_xof,pass_duration_minutes,night_price_xof,night_duration_nights,is_active,occupied_until,created_at,updated_at").eq("tenant_id", tenantId).eq("is_active", true).order("room_number").limit(100);
    if (error) return NextResponse.json({ error: "Impossible de charger les chambres." }, { status: 500 });
    return NextResponse.json({ rooms: data ?? [] });
  } catch { return NextResponse.json({ error: "Service Auberge temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json(); const tenantId = normalize(body.tenantId); const roomNumber = normalize(body.roomNumber); const passPriceXof = Number(body.passPriceXof); const passDurationMinutes = Number(body.passDurationMinutes ?? 60); const nightPriceXof = Number(body.nightPriceXof); const nightDurationNights = Number(body.nightDurationNights ?? 1);
    if (!tenantId || !roomNumber || !Number.isInteger(passPriceXof) || passPriceXof < 0 || !Number.isInteger(passDurationMinutes) || passDurationMinutes < 1 || !Number.isInteger(nightPriceXof) || nightPriceXof < 0 || !Number.isInteger(nightDurationNights) || nightDurationNights < 1) return NextResponse.json({ error: "Chambre, tarifs et durées valides requis." }, { status: 400 });
    const context = await getAuthorizationContext(); if (!allowed(context, tenantId, true)) return NextResponse.json({ error: "Permission insuffisante pour gérer les chambres." }, { status: 403 });
    const admin = createSupabaseAdminClient(); const { data, error } = await admin.from("power_lodging_rooms").insert({ tenant_id: tenantId, room_number: roomNumber, pass_price_xof: passPriceXof, pass_duration_minutes: passDurationMinutes, night_price_xof: nightPriceXof, night_duration_nights: nightDurationNights }).select("id,tenant_id,room_number,pass_price_xof,pass_duration_minutes,night_price_xof,night_duration_nights,is_active,occupied_until").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Cette chambre existe déjà." : "Impossible de créer la chambre." }, { status: 400 });
    return NextResponse.json({ room: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête chambre invalide." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json(); const tenantId = normalize(body.tenantId); const roomId = normalize(body.roomId); const patch: Record<string, unknown> = {};
    if (body.roomNumber !== undefined) patch.room_number = normalize(body.roomNumber); if (body.passPriceXof !== undefined) patch.pass_price_xof = Number(body.passPriceXof); if (body.passDurationMinutes !== undefined) patch.pass_duration_minutes = Number(body.passDurationMinutes); if (body.nightPriceXof !== undefined) patch.night_price_xof = Number(body.nightPriceXof); if (body.nightDurationNights !== undefined) patch.night_duration_nights = Number(body.nightDurationNights); if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
    if (!tenantId || !roomId || !Object.keys(patch).length || (patch.pass_price_xof !== undefined && (!Number.isInteger(patch.pass_price_xof) || Number(patch.pass_price_xof) < 0)) || (patch.night_price_xof !== undefined && (!Number.isInteger(patch.night_price_xof) || Number(patch.night_price_xof) < 0)) || (patch.pass_duration_minutes !== undefined && (!Number.isInteger(patch.pass_duration_minutes) || Number(patch.pass_duration_minutes) < 1)) || (patch.night_duration_nights !== undefined && (!Number.isInteger(patch.night_duration_nights) || Number(patch.night_duration_nights) < 1))) return NextResponse.json({ error: "Paramètres de chambre invalides." }, { status: 400 });
    const context = await getAuthorizationContext(); if (!allowed(context, tenantId, true)) return NextResponse.json({ error: "Permission insuffisante pour modifier les chambres." }, { status: 403 });
    const admin = createSupabaseAdminClient(); const { data, error } = await admin.from("power_lodging_rooms").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", roomId).eq("tenant_id", tenantId).select("id,tenant_id,room_number,pass_price_xof,pass_duration_minutes,night_price_xof,night_duration_nights,is_active,occupied_until").single();
    if (error) return NextResponse.json({ error: "Impossible de modifier la chambre." }, { status: 400 }); return NextResponse.json({ room: data });
  } catch { return NextResponse.json({ error: "Requête chambre invalide." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json(); const tenantId = normalize(body.tenantId); const roomId = normalize(body.roomId); const context = await getAuthorizationContext(); if (!allowed(context, tenantId, true)) return NextResponse.json({ error: "Permission insuffisante pour supprimer la chambre." }, { status: 403 });
    const admin = createSupabaseAdminClient(); const { error } = await admin.from("power_lodging_rooms").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", roomId).eq("tenant_id", tenantId).is("is_active", true); if (error) return NextResponse.json({ error: "Impossible de retirer la chambre." }, { status: 400 }); return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Requête chambre invalide." }, { status: 400 }); }
}
