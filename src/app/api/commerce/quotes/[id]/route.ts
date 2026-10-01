// DebitMaster Commerce API: consultation et mise à jour d'un devis
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: quote, error: quoteError } = await admin
      .from("quotes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Devis introuvable." }, { status: 404 });
    }

    if (!context.tenantIds.includes(quote.tenant_id)) {
      return NextResponse.json({ error: "Accès refusé à ce devis." }, { status: 403 });
    }

    const { data: items } = await admin
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      quote: {
        ...quote,
        items: items ?? [],
      },
    });
  } catch {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: quote } = await admin.from("quotes").select("id, tenant_id, status").eq("id", id).maybeSingle();
    if (!quote) return NextResponse.json({ error: "Devis introuvable." }, { status: 404 });

    if (!context.tenantIds.includes(quote.tenant_id)) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
    }

    if (!can(context, "quotes.create") && !can(context, "orders.create")) {
      return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    }

    const allowedStatuses = ["DRAFT", "PENDING", "ACCEPTED", "REJECTED"];
    const newStatus = typeof body.status === "string" && allowedStatuses.includes(body.status) ? body.status : undefined;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : undefined;
    const terms = typeof body.terms === "string" ? body.terms.trim().slice(0, 500) : undefined;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newStatus) updates.status = newStatus;
    if (notes !== undefined) updates.notes = notes;
    if (terms !== undefined) updates.terms = terms;

    const { data: updated, error } = await admin
      .from("quotes")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Impossible de mettre à jour le devis." }, { status: 400 });

    return NextResponse.json({ quote: updated });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 });
  }
}
