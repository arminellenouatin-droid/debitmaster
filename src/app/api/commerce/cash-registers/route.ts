import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function GET() {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: registers, error } = await admin
      .from("cash_registers")
      .select(`
        id,
        name,
        status,
        store_id,
        inventory_stores(id, name),
        created_at
      `)
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les caisses." }, { status: 500 });
    }

    // Récupérer les sessions ouvertes en cours
    const { data: activeSessions } = await admin
      .from("cash_register_sessions")
      .select("id, cash_register_id, opened_by_user_id, opened_at, opening_float")
      .eq("tenant_id", context.tenantId)
      .eq("status", "OPEN");

    const sessionMap = new Map((activeSessions ?? []).map((s) => [s.cash_register_id, s]));

    const result = (registers ?? []).map((reg) => ({
      ...reg,
      activeSession: sessionMap.get(reg.id) ?? null,
    }));

    return NextResponse.json({ registers: result });
  } catch (cause) {
    console.error("[cash-registers.GET] error", cause);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    // Seuls gérant ou admin peuvent créer des caisses
    const isOwner = context.role === "ADMINISTRATEUR" && context.employeeId === null;
    const isGerant = context.role === "GERANT" || context.role === "GERANT_ADJOINT";
    if (!isOwner && !isGerant && !context.permissions.has("cash.manage")) {
      return NextResponse.json({ error: "Permission insuffisante pour créer une caisse." }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Nom de caisse invalide." }, { status: 400 });
    }
    if (!storeId) {
      return NextResponse.json({ error: "Magasin de rattachement requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("cash_registers")
      .insert({
        tenant_id: context.tenantId,
        store_id: storeId,
        name,
        status: "ACTIVE",
      })
      .select("id, name, store_id, status, created_at")
      .single();

    if (error) {
      console.error("[cash-registers.POST] insert failed", error);
      return NextResponse.json({ error: "Impossible de créer la caisse (nom possiblement déjà utilisé)." }, { status: 400 });
    }

    return NextResponse.json({ register: data }, { status: 201 });
  } catch (cause) {
    console.error("[cash-registers.POST] error", cause);
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
