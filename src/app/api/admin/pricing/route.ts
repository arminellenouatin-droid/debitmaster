// DebitMaster SaaS Admin Pricing API (PRD v1.1 Section 9)
// Permet au super-administrateur de piloter la tarification des 6 activités,
// les paramètres globaux (durée essai, remises) et de consulter l'historique d'audit.

import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import {
  subscriptionActivityCodes,
  referenceActivityConfigs,
  normalizeActivityCode,
  type SubscriptionActivityCode,
} from "@/lib/subscription-plans";

const errorResponse = (message: string, status = 403) =>
  NextResponse.json({ error: message }, { status });

interface ActivityPlanAdminRow {
  activite: string;
  nom_affiche: string;
  prix_mensuel_normal: number;
  coefficient_special: number;
  prix_mensuel_special: number;
  taux_reduction_annuelle: number;
  prix_annuel_normal: number;
  prix_annuel_special: number;
  prix_annuel_normal_override: number | null;
  prix_annuel_special_override: number | null;
  statut_disponibilite: boolean;
  description_courte: string;
  description_option_speciale: string;
  fonctionnalites_normales: string[];
  fonctionnalites_speciales: string[];
  date_maj?: string;
}

export async function GET() {
  const context = await getAuthorizationContext();
  if (!context.user) return errorResponse("Authentification requise.", 401);
  if (!context.isPlatformAdmin) return errorResponse("Accès super-administration requis.");

  // 1. Charger les paramètres globaux (ou valeurs par défaut PRD v1.1)
  let globalParams = {
    trialDays: 30,
    defaultSpecialMultiplier: 1.5,
    defaultAnnualDiscountRate: 0.25,
    updatedAt: new Date().toISOString(),
  };

  try {
    const { data: paramsData, error: paramsError } = await context.supabase
      .from("parametres_globaux_abonnement")
      .select("duree_essai_jours, coefficient_option_speciale_defaut, taux_reduction_annuelle_defaut, date_maj")
      .eq("id", 1)
      .maybeSingle();

    if (!paramsError && paramsData) {
      globalParams = {
        trialDays: Number(paramsData.duree_essai_jours) || 30,
        defaultSpecialMultiplier: Number(paramsData.coefficient_option_speciale_defaut) || 1.5,
        defaultAnnualDiscountRate: 1 - (Number(paramsData.taux_reduction_annuelle_defaut) || 0.75),
        updatedAt: paramsData.date_maj,
      };
    }
  } catch {
    // Table non encore présente, conservation des valeurs par défaut
  }

  // 2. Charger les plans d'activité depuis `plans_activite`
  const activitiesMap: Record<string, ActivityPlanAdminRow> = {};

  // Initialisation par défaut avec la grille de référence PRD v1.1
  for (const code of subscriptionActivityCodes) {
    const ref = referenceActivityConfigs[code];
    const monthlyNormal = ref.monthlyNormalPriceXof;
    const coef = ref.specialMultiplier;
    const monthlySpecial = Math.round(monthlyNormal * coef);
    const annualNormal = Math.round(monthlyNormal * 12 * 0.75);
    const annualSpecial = Math.round(monthlySpecial * 12 * 0.75);

    activitiesMap[code] = {
      activite: code,
      nom_affiche: ref.label,
      prix_mensuel_normal: monthlyNormal,
      coefficient_special: coef,
      prix_mensuel_special: monthlySpecial,
      taux_reduction_annuelle: 0.75,
      prix_annuel_normal: annualNormal,
      prix_annuel_special: annualSpecial,
      prix_annuel_normal_override: null,
      prix_annuel_special_override: null,
      statut_disponibilite: ref.isAvailable,
      description_courte: ref.tagline,
      description_option_speciale: ref.specialDescription,
      fonctionnalites_normales: ref.normalFeatures,
      fonctionnalites_speciales: ref.specialFeatures,
    };
  }

  try {
    const { data: plansData, error: plansError } = await context.supabase
      .from("plans_activite")
      .select("*")
      .order("prix_mensuel_normal", { ascending: true });

    if (!plansError && Array.isArray(plansData) && plansData.length > 0) {
      for (const row of plansData) {
        if (activitiesMap[row.activite]) {
          activitiesMap[row.activite] = {
            ...activitiesMap[row.activite],
            ...row,
            fonctionnalites_normales: Array.isArray(row.fonctionnalites_normales)
              ? row.fonctionnalites_normales
              : activitiesMap[row.activite].fonctionnalites_normales,
            fonctionnalites_speciales: Array.isArray(row.fonctionnalites_speciales)
              ? row.fonctionnalites_speciales
              : activitiesMap[row.activite].fonctionnalites_speciales,
          };
        }
      }
    }
  } catch {
    // Table non encore présente, conservation des valeurs de référence
  }

  // 3. Charger l'historique d'audit depuis `historique_prix_plans`
  let auditLogs: Array<{
    id: string;
    plan_id: string;
    champ_modifie: string;
    ancien_prix: string;
    nouveau_prix: string;
    auteur: string | null;
    date: string;
  }> = [];

  try {
    const { data: logsData, error: logsError } = await context.supabase
      .from("historique_prix_plans")
      .select("id, plan_id, champ_modifie, ancien_prix, nouveau_prix, auteur, date")
      .order("date", { ascending: false })
      .limit(50);

    if (!logsError && Array.isArray(logsData)) {
      auditLogs = logsData;
    }
  } catch {
    // Ignorer si la table n'existe pas encore
  }

  // 4. Charger également `saas_plan_prices` pour compatibilité descendante
  let prices: Array<{
    id: string;
    activity_code: string;
    plan_code: string;
    billing_period: "MONTHLY" | "ANNUAL";
    price_xof: number;
    description: string;
    is_active: boolean;
    updated_at: string;
  }> = [];

  try {
    const { data: legacyPrices } = await context.supabase
      .from("saas_plan_prices")
      .select("id, activity_code, plan_code, billing_period, price_xof, description, is_active, updated_at")
      .order("activity_code")
      .order("plan_code")
      .limit(100);

    if (Array.isArray(legacyPrices)) {
      prices = legacyPrices;
    }
  } catch {
    // Ignorer
  }

  return NextResponse.json({
    activities: Object.values(activitiesMap),
    globalParams,
    auditLogs,
    prices,
  });
}

export async function PATCH(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return errorResponse("Authentification requise.", 401);
    if (!context.isPlatformAdmin) return errorResponse("Accès super-administration requis.");

    const body = (await request.json()) as Record<string, unknown>;
    const userIdentifier = context.user.email ?? context.user.id;

    // CAS 1 : Mise à jour des paramètres globaux
    if (body.type === "global_params" || ("trialDays" in body && !("activityCode" in body))) {
      const trialDays = Number(body.trialDays);
      const defaultSpecialMultiplier = Number(body.defaultSpecialMultiplier ?? 1.5);
      const discountRate = Number(body.defaultAnnualDiscountRate ?? 0.25);
      const factorAnnual = Number((1 - discountRate).toFixed(2));
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "Mise à jour paramètres globaux";

      if (!Number.isSafeInteger(trialDays) || trialDays < 1) {
        return errorResponse("La durée d'essai doit être un entier supérieur ou égal à 1 jour.", 400);
      }
      if (defaultSpecialMultiplier <= 0) {
        return errorResponse("Le coefficient d'option spéciale doit être strictement supérieur à 0.", 400);
      }

      try {
        await context.supabase
          .from("parametres_globaux_abonnement")
          .upsert({
            id: 1,
            duree_essai_jours: trialDays,
            coefficient_option_speciale_defaut: defaultSpecialMultiplier,
            taux_reduction_annuelle_defaut: factorAnnual,
            date_maj: new Date().toISOString(),
            maj_par: context.user.id,
          });

        // Logger dans l'historique
        await context.supabase.from("historique_prix_plans").insert({
          plan_id: "GLOBAL_PARAMETERS",
          champ_modifie: "duree_essai_jours",
          ancien_prix: "Variable",
          nouveau_prix: `${trialDays} jours (motif: ${reason})`,
          auteur: userIdentifier,
          date: new Date().toISOString(),
        });
      } catch {
        // En cas d'absence de la table en local
      }

      return NextResponse.json({
        success: true,
        globalParams: {
          trialDays,
          defaultSpecialMultiplier,
          defaultAnnualDiscountRate: discountRate,
        },
      });
    }

    // CAS 2 : Mise à jour d'un plan d'activité unifié
    if (body.type === "activity_plan" || ("monthlyNormalPrice" in body && "activityCode" in body)) {
      const activityCode = normalizeActivityCode(String(body.activityCode ?? ""));
      if (!subscriptionActivityCodes.includes(activityCode as SubscriptionActivityCode)) {
        return errorResponse("Activité inconnue ou non supportée.", 400);
      }

      const monthlyNormal = Number(body.monthlyNormalPrice);
      if (!Number.isSafeInteger(monthlyNormal) || monthlyNormal <= 0) {
        return errorResponse("Le montant mensuel normal doit être un entier positif en FCFA.", 400);
      }

      const specialMultiplier = Number(body.specialMultiplier ?? 1.5);
      if (specialMultiplier <= 0) {
        return errorResponse("Le coefficient d'option spéciale doit être supérieur à 0.", 400);
      }

      const annualNormalOverride =
        body.annualNormalOverride !== undefined && body.annualNormalOverride !== null && Number(body.annualNormalOverride) > 0
          ? Math.round(Number(body.annualNormalOverride))
          : null;

      const annualSpecialOverride =
        body.annualSpecialOverride !== undefined && body.annualSpecialOverride !== null && Number(body.annualSpecialOverride) > 0
          ? Math.round(Number(body.annualSpecialOverride))
          : null;

      const isAvailable = body.isAvailable === undefined ? true : Boolean(body.isAvailable);
      const specialDescription =
        typeof body.specialDescription === "string" ? body.specialDescription.trim().slice(0, 500) : undefined;
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "Mise à jour tarifaire";

      // Calcul des montants automatiques
      const monthlySpecial = Math.round(monthlyNormal * specialMultiplier);
      const annualNormal = annualNormalOverride ?? Math.round(monthlyNormal * 12 * 0.75);
      const annualSpecial = annualSpecialOverride ?? Math.round(monthlySpecial * 12 * 0.75);

      const ref = referenceActivityConfigs[activityCode as SubscriptionActivityCode];

      // Upsert dans `plans_activite`
      try {
        await context.supabase.from("plans_activite").upsert({
          activite: activityCode,
          nom_affiche: ref.label,
          prix_mensuel_normal: monthlyNormal,
          coefficient_special: specialMultiplier,
          prix_mensuel_special: monthlySpecial,
          taux_reduction_annuelle: 0.75,
          prix_annuel_normal: annualNormal,
          prix_annuel_special: annualSpecial,
          prix_annuel_normal_override: annualNormalOverride,
          prix_annuel_special_override: annualSpecialOverride,
          statut_disponibilite: isAvailable,
          description_courte: ref.tagline,
          description_option_speciale: specialDescription ?? ref.specialDescription,
          date_maj: new Date().toISOString(),
          maj_par: context.user.id,
        });
      } catch {
        // Table non encore créée
      }

      // Trace d'audit dans `historique_prix_plans`
      try {
        await context.supabase.from("historique_prix_plans").insert({
          plan_id: activityCode,
          champ_modifie: "prix_mensuel_normal & formule",
          ancien_prix: "Variable",
          nouveau_prix: `${monthlyNormal} XOF/mois (Spécial: ${monthlySpecial} XOF, Annuel: ${annualNormal} XOF, motif: ${reason})`,
          auteur: userIdentifier,
          date: new Date().toISOString(),
        });
      } catch {
        // Table non encore créée
      }

      // Synchronisation de secours dans `saas_plan_prices` pour assurer la non-régression
      try {
        const syncRows = [
          {
            activity_code: activityCode,
            plan_code: activityCode,
            billing_period: "MONTHLY",
            price_xof: monthlyNormal,
            description: `${ref.label} — Normal Mensuel`,
            is_active: isAvailable,
            updated_by: context.user.id,
            updated_at: new Date().toISOString(),
          },
          {
            activity_code: activityCode,
            plan_code: activityCode,
            billing_period: "ANNUAL",
            price_xof: annualNormal,
            description: `${ref.label} — Normal Annuel (-25%)`,
            is_active: isAvailable,
            updated_by: context.user.id,
            updated_at: new Date().toISOString(),
          },
          {
            activity_code: activityCode,
            plan_code: `${activityCode}_SPECIAL`,
            billing_period: "MONTHLY",
            price_xof: monthlySpecial,
            description: `${ref.label} — Option Spéciale Mensuelle (+50%)`,
            is_active: isAvailable,
            updated_by: context.user.id,
            updated_at: new Date().toISOString(),
          },
          {
            activity_code: activityCode,
            plan_code: `${activityCode}_SPECIAL`,
            billing_period: "ANNUAL",
            price_xof: annualSpecial,
            description: `${ref.label} — Option Spéciale Annuelle`,
            is_active: isAvailable,
            updated_by: context.user.id,
            updated_at: new Date().toISOString(),
          },
        ];

        for (const row of syncRows) {
          await context.supabase
            .from("saas_plan_prices")
            .upsert(row, { onConflict: "activity_code,plan_code,billing_period" });
        }
      } catch {
        // Ignorer
      }

      return NextResponse.json({
        success: true,
        activity: {
          activite: activityCode,
          prix_mensuel_normal: monthlyNormal,
          coefficient_special: specialMultiplier,
          prix_mensuel_special: monthlySpecial,
          prix_annuel_normal: annualNormal,
          prix_annuel_special: annualSpecial,
          prix_annuel_normal_override: annualNormalOverride,
          prix_annuel_special_override: annualSpecialOverride,
          statut_disponibilite: isAvailable,
        },
      });
    }

    // CAS 3 : Compatibilité avec les anciennes requêtes directes sur `saas_plan_prices`
    const activityCode = normalizeActivityCode(typeof body.activityCode === "string" ? body.activityCode : "");
    const planCode = typeof body.planCode === "string" ? body.planCode.toUpperCase() : "";
    const billingPeriod = typeof body.billingPeriod === "string" ? body.billingPeriod.toUpperCase() : "MONTHLY";
    const priceXof = Number(body.priceXof);
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : "";

    if (
      !subscriptionActivityCodes.includes(activityCode as SubscriptionActivityCode) ||
      !Number.isSafeInteger(priceXof) ||
      priceXof <= 0
    ) {
      return errorResponse("Paramètres tarifaires invalides.", 400);
    }

    const { data, error } = await context.supabase
      .from("saas_plan_prices")
      .upsert(
        {
          activity_code: activityCode,
          plan_code: planCode,
          billing_period: billingPeriod,
          price_xof: priceXof,
          description,
          is_active: true,
          updated_by: context.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "activity_code,plan_code,billing_period" }
      )
      .select("id,activity_code,plan_code,billing_period,price_xof,description,is_active,updated_at")
      .single();

    if (error || !data) return errorResponse("Impossible d’enregistrer ce tarif SaaS.", 400);

    return NextResponse.json({ price: data });
  } catch {
    return errorResponse("Requête invalide.", 400);
  }
}
