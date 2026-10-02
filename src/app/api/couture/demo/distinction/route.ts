import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import {
  distinctionSitesSpec,
  distinctionPriceMatrix,
  distinctionStaffSummary,
  distinctionWorkSchedulesSpec,
} from "@/lib/couture-distinction-provisioning";

export async function GET() {
  try {
    const admin = createSupabaseAdminClient();

    // Récupérer le tenant DISTINCTION s'il existe
    const { data: distinctionCompany } = await admin
      .from("companies")
      .select("*")
      .eq("name", "DISTINCTION")
      .eq("activity_type", "ATELIER_COUTURE")
      .maybeSingle();

    let sites: any[] = [];
    let modelsCount = 0;
    let ratesCount = 0;

    if (distinctionCompany) {
      const { data: dbSites } = await admin
        .from("couture_sites")
        .select("*")
        .eq("tenant_id", distinctionCompany.id);

      sites = dbSites ?? [];

      const { count: mCount } = await admin
        .from("couture_models")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", distinctionCompany.id);

      modelsCount = mCount ?? 0;

      const { count: rCount } = await admin
        .from("couture_piecework_rates")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", distinctionCompany.id);

      ratesCount = rCount ?? 0;
    }

    return NextResponse.json({
      status: "CONFIGURED",
      name: "DISTINCTION",
      activity: "ATELIER_COUTURE",
      isProvisionedInDb: Boolean(distinctionCompany),
      company: distinctionCompany,
      sitesSummary: {
        totalSites: 6,
        ateliers: 1,
        boutiquesLome: 3,
        boutiquesDouala: 2,
        specification: distinctionSitesSpec,
        databaseSites: sites,
      },
      catalogSummary: {
        models: distinctionPriceMatrix,
        modelsCountInDb: modelsCount,
      },
      pieceworkRatesCountInDb: ratesCount,
      staffSummary: distinctionStaffSummary,
      workSchedules: distinctionWorkSchedulesSpec,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // Exécution de la fonction de provisionnement DISTINCTION
    const { data: tenantId, error } = await admin.rpc("provision_distinction_demo_establishment");

    if (error) {
      return NextResponse.json({
        error: `Erreur lors du provisionnement de DISTINCTION: ${error.message}`,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tenantId,
      message: "Établissement de démonstration DISTINCTION provisionné avec succès en base.",
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
