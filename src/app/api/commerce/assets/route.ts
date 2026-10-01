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

    const admin = createSupabaseAdminClient();

    const { data: assets, error: assetErr } = await admin
      .from("commerce_fixed_assets")
      .select(`
        id, asset_code, name, syscohada_account, category, acquisition_date,
        acquisition_cost_xof, salvage_value_xof, lifespan_years, depreciation_method,
        location, store_id, serial_number, supplier_name, accumulated_depreciation_xof,
        net_book_value_xof, status, disposal_date, disposal_proceeds_xof, created_at
      `)
      .eq("tenant_id", context.tenantId)
      .order("acquisition_date", { ascending: false });

    if (assetErr) {
      console.error("[assets.GET] error", assetErr);
      return NextResponse.json({ error: "Impossible de récupérer les immobilisations." }, { status: 500 });
    }

    let totalAcquisitionCost = 0;
    let totalAccumulatedDeprec = 0;
    let totalNetBookValue = 0;

    for (const a of assets || []) {
      if (a.status === "ACTIVE") {
        totalAcquisitionCost += Number(a.acquisition_cost_xof) || 0;
        totalAccumulatedDeprec += Number(a.accumulated_depreciation_xof) || 0;
        totalNetBookValue += Number(a.net_book_value_xof) || 0;
      }
    }

    const { data: stores } = await admin
      .from("commerce_stores")
      .select("id, name")
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true });

    return NextResponse.json({
      assets: assets || [],
      stores: stores || [],
      summary: {
        totalAcquisitionCost,
        totalAccumulatedDeprec,
        totalNetBookValue,
      },
    });
  } catch (err) {
    console.error("[assets.GET] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
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
    const {
      name,
      syscohadaAccount = "241",
      category,
      acquisitionDate,
      acquisitionCostXof,
      salvageValueXof = 0,
      lifespanYears,
      depreciationMethod = "LINEAIRE",
      location,
      storeId,
      serialNumber,
      supplierName,
    } = body;

    if (!name || !category || !acquisitionCostXof || !lifespanYears) {
      return NextResponse.json({
        error: "Le nom, la catégorie, le coût d'acquisition et la durée d'utilité sont obligatoires.",
      }, { status: 400 });
    }

    const cost = Math.round(Number(acquisitionCostXof));
    const salvage = Math.max(0, Math.round(Number(salvageValueXof) || 0));
    const years = Math.round(Number(lifespanYears));

    if (cost <= 0) {
      return NextResponse.json({ error: "Le coût d'acquisition doit être strictement supérieur à zéro." }, { status: 400 });
    }

    if (years <= 0 || years > 50) {
      return NextResponse.json({ error: "La durée d'amortissement doit être comprise entre 1 et 50 ans." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Génération du numéro séquentiel IMM
    let assetCode: string;
    try {
      const { data: numData, error: numErr } = await admin.rpc("next_document_number", {
        p_tenant_id: context.tenantId,
        p_doc_type: "FIXED_ASSET",
      });
      if (numErr || !numData) {
        assetCode = `IMM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      } else {
        assetCode = numData;
      }
    } catch {
      assetCode = `IMM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }

    // 2. Insérer l'immobilisation
    const { data: createdAsset, error: assetErr } = await admin
      .from("commerce_fixed_assets")
      .insert({
        tenant_id: context.tenantId,
        asset_code: assetCode,
        name: String(name).trim(),
        syscohada_account: syscohadaAccount,
        category,
        acquisition_date: acquisitionDate || new Date().toISOString().split("T")[0],
        acquisition_cost_xof: cost,
        salvage_value_xof: salvage,
        lifespan_years: years,
        depreciation_method: depreciationMethod,
        location: location ? String(location).trim() : null,
        store_id: storeId || null,
        serial_number: serialNumber ? String(serialNumber).trim() : null,
        supplier_name: supplierName ? String(supplierName).trim() : null,
        accumulated_depreciation_xof: 0,
        net_book_value_xof: cost,
        status: "ACTIVE",
        created_by_user_id: context.user.id,
      })
      .select()
      .single();

    if (assetErr || !createdAsset) {
      console.error("[assets.POST] insert error", assetErr);
      return NextResponse.json({ error: "Échec d'enregistrement de l'immobilisation." }, { status: 500 });
    }

    // 3. Génération automatique du plan d'amortissement linéaire
    const startYear = new Date(createdAsset.acquisition_date).getFullYear();
    const depreciableBase = Math.max(0, cost - salvage);
    const annualDeprec = Math.round(depreciableBase / years);

    const scheduleLines = [];
    let accumulated = 0;

    for (let i = 0; i < years; i++) {
      const currentYear = startYear + i;
      // Pour la dernière année, ajuster pour que la dotation cumulée soit exactement égale à la base
      const isLastYear = i === years - 1;
      const amount = isLastYear ? (depreciableBase - accumulated) : annualDeprec;
      accumulated += amount;
      const nbv = Math.max(salvage, cost - accumulated);

      scheduleLines.push({
        asset_id: createdAsset.id,
        tenant_id: context.tenantId,
        period_year: currentYear,
        base_amount_xof: depreciableBase,
        depreciation_amount_xof: amount,
        accumulated_depreciation_xof: accumulated,
        net_book_value_xof: nbv,
        is_posted: false,
      });
    }

    await admin.from("commerce_asset_depreciation_lines").insert(scheduleLines);

    return NextResponse.json({
      success: true,
      asset: createdAsset,
      message: `Immobilisation ${assetCode} (${name}) enregistrée avec son plan d'amortissement sur ${years} an(s).`,
    });
  } catch (err) {
    console.error("[assets.POST] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
