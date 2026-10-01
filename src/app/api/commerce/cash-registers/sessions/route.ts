import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const registerId = searchParams.get("registerId");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("cash_register_sessions")
      .select(`
        id,
        cash_register_id,
        cash_registers(name, store_id),
        opened_by_user_id,
        closed_by_user_id,
        opened_at,
        closed_at,
        opening_float,
        status,
        expected_cash,
        closing_cash_counted,
        cash_difference,
        difference_reason,
        total_collected,
        total_payments_count
      `)
      .eq("tenant_id", context.tenantId)
      .order("opened_at", { ascending: false })
      .limit(50);

    if (activeOnly) {
      query = query.eq("status", "OPEN");
    }
    if (registerId) {
      query = query.eq("cash_register_id", registerId);
    }

    const { data: sessions, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Impossible de charger les sessions." }, { status: 500 });
    }

    // Trouver la session active de l'utilisateur courant s'il y en a une
    const myActiveSession = sessions?.find(
      (s) => s.status === "OPEN" && s.opened_by_user_id === context.user!.id
    ) ?? null;

    return NextResponse.json({ sessions: sessions ?? [], myActiveSession });
  } catch (cause) {
    console.error("[sessions.GET] error", cause);
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

    const body = await request.json();
    const registerId = typeof body.registerId === "string" ? body.registerId.trim() : "";
    const openingFloat = Math.max(0, Math.floor(Number(body.openingFloat) || 0));

    if (!registerId) {
      return NextResponse.json({ error: "Caisse obligatoire pour ouvrir une session." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Vérifier si la caisse est déjà occupée par une session ouverte
    const { data: existingOpen } = await admin
      .from("cash_register_sessions")
      .select("id, opened_by_user_id")
      .eq("tenant_id", context.tenantId)
      .eq("cash_register_id", registerId)
      .eq("status", "OPEN")
      .maybeSingle();

    if (existingOpen) {
      return NextResponse.json(
        { error: "Cette caisse est déjà ouverte. Veuillez clôturer la session précédente avant d'en ouvrir une nouvelle." },
        { status: 409 }
      );
    }

    // Vérifier si l'utilisateur a déjà une autre session ouverte sur une autre caisse
    const { data: userOpenSession } = await admin
      .from("cash_register_sessions")
      .select("id, cash_registers(name)")
      .eq("tenant_id", context.tenantId)
      .eq("opened_by_user_id", context.user.id)
      .eq("status", "OPEN")
      .maybeSingle();

    if (userOpenSession) {
      return NextResponse.json(
        { error: "Vous avez déjà une session ouverte sur une autre caisse. Veuillez la clôturer d'abord." },
        { status: 409 }
      );
    }

    const { data, error } = await admin
      .from("cash_register_sessions")
      .insert({
        tenant_id: context.tenantId,
        cash_register_id: registerId,
        opened_by_user_id: context.user.id,
        opening_float: openingFloat,
        status: "OPEN",
        expected_cash: openingFloat,
      })
      .select("id, cash_register_id, opened_at, opening_float, status, expected_cash")
      .single();

    if (error || !data) {
      console.error("[sessions.POST] open failed", error);
      return NextResponse.json({ error: "Impossible d'ouvrir la session de caisse." }, { status: 400 });
    }

    return NextResponse.json({ session: data }, { status: 201 });
  } catch (cause) {
    console.error("[sessions.POST] error", cause);
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
