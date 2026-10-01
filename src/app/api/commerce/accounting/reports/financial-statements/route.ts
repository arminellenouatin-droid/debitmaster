import { NextResponse } from "next/server";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const context = await getActiveTenantContext();
    if (!context.user || !context.tenantId) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fiscalYear = searchParams.get("year");

    const admin = createSupabaseAdminClient();

    const { data: lines, error } = await admin
      .from("commerce_journal_entry_lines")
      .select(`
        account_number, account_name, debit_amount_xof, credit_amount_xof,
        entry:commerce_journal_entries!commerce_journal_entry_lines_entry_id_fkey(fiscal_year)
      `)
      .eq("tenant_id", context.tenantId);

    if (error) {
      console.error("[reports/financial-statements.GET] error", error);
      return NextResponse.json({ error: "Impossible de calculer les états financiers." }, { status: 500 });
    }

    // Calcul des soldes nets par compte
    const accountBalances = new Map<string, number>();

    for (const line of lines || []) {
      // @ts-expect-error Supabase nested relation
      if (fiscalYear && line.entry?.fiscal_year !== parseInt(fiscalYear, 10)) {
        continue;
      }
      const acc = line.account_number;
      const current = accountBalances.get(acc) || 0;
      // Pour les comptes d'actif/charges, solde normal = débit - crédit
      // Pour les comptes de passif/produits, solde normal = crédit - débit
      accountBalances.set(acc, current + (Number(line.debit_amount_xof) || 0) - (Number(line.credit_amount_xof) || 0));
    }

    // Helper pour sommer les soldes par préfixe de compte
    const getNetDebit = (prefix: string) => {
      let sum = 0;
      for (const [acc, bal] of accountBalances.entries()) {
        if (acc.startsWith(prefix)) {
          sum += bal;
        }
      }
      return sum;
    };

    const getNetCredit = (prefix: string) => {
      let sum = 0;
      for (const [acc, bal] of accountBalances.entries()) {
        if (acc.startsWith(prefix)) {
          sum += -bal; // Solde créditeur
        }
      }
      return sum;
    };

    // 1. COMPTE DE RÉSULTAT SYSCOHADA
    const ventesMarchandises = getNetCredit("701");
    const ventesServices = getNetCredit("706") + getNetCredit("707");
    const chiffreAffaires = ventesMarchandises + ventesServices;

    const achatsMarchandises = getNetDebit("601");
    const variationStocks = getNetDebit("6031");
    const coutAchatMarchandisesVendues = achatsMarchandises + variationStocks;
    const margeCommerciale = chiffreAffaires - coutAchatMarchandisesVendues;

    const fournituresNonStockees = getNetDebit("605");
    const transports = getNetDebit("624");
    const loyersCharges = getNetDebit("632");
    const entretienMaintenance = getNetDebit("633") + getNetDebit("638");
    const autresChargesExternes = fournituresNonStockees + transports + loyersCharges + entretienMaintenance;
    const valeurAjoutee = margeCommerciale - autresChargesExternes;

    const impotsTaxes = getNetDebit("641");
    const chargesPersonnel = getNetDebit("661");
    const excedentBrutExploitation = valeurAjoutee - impotsTaxes - chargesPersonnel;

    const dotationsAmortissements = getNetDebit("681");
    const resultatExploitation = excedentBrutExploitation - dotationsAmortissements;

    const produitsFinanciers = getNetCredit("77");
    const chargesFinancieres = getNetDebit("67");
    const resultatFinancier = produitsFinanciers - chargesFinancieres;

    const produitsHao = getNetCredit("82");
    const chargesHao = getNetDebit("81");
    const resultatHao = produitsHao - chargesHao;

    const resultatNet = resultatExploitation + resultatFinancier + resultatHao;

    // 2. BILAN SYSCOHADA
    // ACTIF
    const actifImmoBrut = getNetDebit("21") + getNetDebit("23") + getNetDebit("24");
    const amortissementsImmo = getNetCredit("28");
    const actifImmoNet = Math.max(0, actifImmoBrut - amortissementsImmo);

    const stocksMarchandises = Math.max(0, getNetDebit("31") + getNetDebit("32"));
    const creancesClients = Math.max(0, getNetDebit("411"));
    const actifCirculant = stocksMarchandises + creancesClients;

    const banques = Math.max(0, getNetDebit("521"));
    const caisses = Math.max(0, getNetDebit("571") + getNetDebit("572"));
    const tresorerieActif = banques + caisses;

    const totalActif = actifImmoNet + actifCirculant + tresorerieActif;

    // PASSIF
    const capitalSocial = getNetCredit("101");
    const reserves = getNetCredit("111");
    const reportANouveau = getNetCredit("121");
    const capitauxPropres = capitalSocial + reserves + reportANouveau + resultatNet;

    const dettesFinancieres = getNetCredit("16");
    const dettesFournisseurs = Math.max(0, getNetCredit("401"));
    const dettesFiscalesSociales = Math.max(0, getNetCredit("443") + getNetCredit("421"));
    const dettesCirculantes = dettesFournisseurs + dettesFiscalesSociales;

    const totalPassif = capitauxPropres + dettesFinancieres + dettesCirculantes;

    return NextResponse.json({
      compteDeResultat: {
        chiffreAffaires,
        ventesMarchandises,
        ventesServices,
        achatsMarchandises,
        variationStocks,
        coutAchatMarchandisesVendues,
        margeCommerciale,
        autresChargesExternes,
        valeurAjoutee,
        impotsTaxes,
        chargesPersonnel,
        excedentBrutExploitation,
        dotationsAmortissements,
        resultatExploitation,
        resultatFinancier,
        resultatHao,
        resultatNet,
        isBenefice: resultatNet >= 0,
      },
      bilan: {
        actif: {
          actifImmoBrut,
          amortissementsImmo,
          actifImmoNet,
          stocksMarchandises,
          creancesClients,
          actifCirculant,
          tresorerieActif,
          totalActif,
        },
        passif: {
          capitalSocial,
          reserves,
          reportANouveau,
          resultatNetExercice: resultatNet,
          capitauxPropres,
          dettesFinancieres,
          dettesFournisseurs,
          dettesFiscalesSociales,
          dettesCirculantes,
          totalPassif,
        },
        equilibreBilan: Math.abs(totalActif - totalPassif) < 10,
      },
    });
  } catch (err) {
    console.error("[reports/financial-statements.GET] unexpected error", err);
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
