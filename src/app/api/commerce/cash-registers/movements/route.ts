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
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Identifiant de session requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: movements, error } = await admin
      .from("cash_movements")
      .select("id, session_id, user_id, movement_type, amount, reason, reference_note, created_at")
      .eq("tenant_id", context.tenantId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les mouvements de caisse." }, { status: 500 });
    }

    return NextResponse.json({ movements: movements ?? [] });
  } catch (cause) {
    console.error("[cash-movements.GET] error", cause);
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
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const movementType = typeof body.movementType === "string" ? body.movementType.trim() : "";
    const amount = Math.floor(Number(body.amount) || 0);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const referenceNote = typeof body.referenceNote === "string" ? body.referenceNote.trim() : null;

    if (!sessionId) {
      return NextResponse.json({ error: "Session de caisse obligatoire." }, { status: 400 });
    }
    const validTypes = ["CASH_IN", "CASH_OUT", "BANK_DEPOSIT", "EXPENSE"];
    if (!validTypes.includes(movementType)) {
      return NextResponse.json({ error: "Type de mouvement invalide." }, { status: 400 });
    }
    if (amount <= 0) {
      return NextResponse.json({ error: "Le montant doit être supérieur à 0 FCFA." }, { status: 400 });
    }
    if (!reason || reason.length < 3) {
      return NextResponse.json({ error: "Un motif descriptif est obligatoire (min 3 caractères)." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Vérifier que la session est bien ouverte
    const { data: session, error: sErr } = await admin
      .from("cash_register_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (sErr || !session || session.status !== "OPEN") {
      return NextResponse.json({ error: "La session de caisse n'est pas active ou introuvable." }, { status: 400 });
    }

    const { data: movement, error: mErr } = await admin
      .from("cash_movements")
      .insert({
        tenant_id: context.tenantId,
        session_id: sessionId,
        user_id: context.user.id,
        movement_type: movementType,
        amount,
        reason,
        reference_note: referenceNote,
      })
      .select()
      .single();

    if (mErr || !movement) {
      console.error("[cash-movements.POST] insert failed", mErr);
      return NextResponse.json({ error: "Impossible d'enregistrer le mouvement de caisse." }, { status: 500 });
    }

    return NextResponse.json({ movement }, { status: 201 });
  } catch (cause) {
    console.error("[cash-movements.POST] error", cause);
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
