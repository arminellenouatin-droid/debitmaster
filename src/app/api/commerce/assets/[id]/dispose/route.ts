import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }

    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { id: assetId } = await params;
    const body = await request.json();
    const { status = "SCRAPPED", proceedsXof = 0, notes, disposalDate } = body;

    if (!["SCRAPPED", "SOLD"].includes(status)) {
      return NextResponse.json({ error: "Statut de sortie invalide (SCRAPPED ou SOLD)." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: asset, error: assetErr } = await admin
      .from("commerce_fixed_assets")
      .select("id, asset_code, name, net_book_value_xof, status")
      .eq("id", assetId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (assetErr || !asset) {
      return NextResponse.json({ error: "Immobilisation introuvable." }, { status: 404 });
    }

    if (asset.status !== "ACTIVE") {
      return NextResponse.json({ error: `Cette immobilisation est déjà sortie (statut : ${asset.status}).` }, { status: 400 });
    }

    const proceeds = Math.max(0, Math.round(Number(proceedsXof) || 0));
    const nbv = Number(asset.net_book_value_xof);
    const capitalGainLoss = proceeds - nbv;
    const now = new Date().toISOString();

    const { data: updatedAsset, error: updateErr } = await admin
      .from("commerce_fixed_assets")
      .update({
        status,
        disposal_date: disposalDate || new Date().toISOString().split("T")[0],
        disposal_proceeds_xof: proceeds,
        disposal_notes: notes ? String(notes).trim() : null,
        updated_at: now,
      })
      .eq("id", assetId)
      .select()
      .single();

    if (updateErr) {
      console.error("[assets.dispose] update error", updateErr);
      return NextResponse.json({ error: "Échec de la sortie d'immobilisation." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      asset: updatedAsset,
      capitalGainLoss,
      message: status === "SOLD"
        ? `Immobilisation ${asset.asset_code} cédée pour ${proceeds.toLocaleString("fr-FR")} FCFA (Résultat de cession : ${capitalGainLoss >= 0 ? "+" : ""}${capitalGainLoss.toLocaleString("fr-FR")} FCFA).`
        : `Immobilisation ${asset.asset_code} mise au rebut avec succès.`,
    });
  } catch (err) {
    console.error("[assets.dispose] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
