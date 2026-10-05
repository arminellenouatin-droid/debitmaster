// API de gestion du statut et des paramètres de Facture Normalisée DGI Bénin (e-MECeF)
// Accessible exclusivement par le propriétaire / promoteur de l'établissement.

import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { getCompanyDgiSettings, saveCompanyDgiSettings } from "@/lib/dgi-benin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || context.tenantIds[0] || "";

    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    // Récupérer le pays de l'établissement
    const { data: company } = await context.supabase
      .from("companies")
      .select("id, name, country, ifu_number, owner_user_id")
      .eq("id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!company) {
      return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });
    }

    const settings = await getCompanyDgiSettings(context.supabase, tenantId);

    return NextResponse.json({
      success: true,
      tenantId,
      companyName: company.name,
      country: company.country || "BJ",
      isBenin: (company.country || "").toUpperCase() === "BJ",
      settings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne du serveur." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    if (context.employeeId) {
      return NextResponse.json(
        { error: "Seul le propriétaire / promoteur peut configurer la facturation normalisée." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      tenantId?: string;
      isNormalizedInvoiceEnabled?: boolean;
      ifuNumber?: string;
      dgiNim?: string;
      dgiEnv?: "sandbox" | "production";
      dgiApiToken?: string;
    } | null;

    const tenantId = body?.tenantId || context.tenantIds[0] || "";
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    // Vérifier que l'utilisateur est bien le propriétaire
    const { data: company } = await context.supabase
      .from("companies")
      .select("id, owner_user_id, country")
      .eq("id", tenantId)
      .eq("owner_user_id", context.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!company) {
      return NextResponse.json(
        { error: "Seul le propriétaire de cet établissement peut modifier ce réglage." },
        { status: 403 }
      );
    }

    // Si on active la facture normalisée, vérifier ou mettre à jour l'IFU
    const isEnabling = Boolean(body?.isNormalizedInvoiceEnabled);
    const ifuNumber = typeof body?.ifuNumber === "string" ? body.ifuNumber.trim() : undefined;

    const saved = await saveCompanyDgiSettings(context.supabase, tenantId, {
      isNormalizedInvoiceEnabled: isEnabling,
      ifuNumber: ifuNumber,
      dgiNim: body?.dgiNim,
      dgiEnv: body?.dgiEnv,
      dgiApiToken: body?.dgiApiToken,
    });

    return NextResponse.json({
      success: true,
      tenantId,
      message: isEnabling
        ? "✓ Facturation normalisée DGI Bénin (e-MECeF) activée avec succès !"
        : "Facturation normalisée désactivée. Les factures seront émises simplement.",
      settings: saved,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de l'enregistrement." },
      { status: 500 }
    );
  }
}
