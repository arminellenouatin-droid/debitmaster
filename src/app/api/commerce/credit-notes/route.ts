import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: creditNotes, error } = await admin
      .from("credit_notes")
      .select("id, credit_note_number, order_id, return_id, customer_name, amount, currency, reason, created_at")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les avoirs." }, { status: 500 });
    }

    return NextResponse.json({ creditNotes: creditNotes ?? [] });
  } catch (cause) {
    console.error("[credit-notes.GET] error", cause);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
