import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { id: assetId } = await params;
    const admin = createSupabaseAdminClient();

    const { data: asset, error: assetErr } = await admin
      .from("commerce_fixed_assets")
      .select(`
        id, asset_code, name, syscohada_account, category, acquisition_date,
        acquisition_cost_xof, salvage_value_xof, lifespan_years, depreciation_method,
        location, store_id, serial_number, supplier_name, accumulated_depreciation_xof,
        net_book_value_xof, status, disposal_date, disposal_proceeds_xof, disposal_notes, created_at,
        commerce_asset_depreciation_lines (
          id, period_year, base_amount_xof, depreciation_amount_xof, accumulated_depreciation_xof, net_book_value_xof, is_posted
        )
      `)
      .eq("id", assetId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (assetErr || !asset) {
      return NextResponse.json({ error: "Immobilisation introuvable." }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (err) {
    console.error("[assets.[id].GET] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
