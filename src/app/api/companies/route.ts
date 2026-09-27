// DebitManager tenant API: toutes les opérations sont bornées par l’utilisateur Supabase courant.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const activityTypes = ["BUVETTE", "BAR_RESTAURANT", "NIGHTCLUB_LOUNGE", "HOTEL_AUBERGE", "POWER"] as const;

export async function GET() {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.length) return NextResponse.json({ companies: [] });
    const { data, error } = await context.supabase
      .from("companies")
      .select("id,name,activity_type,country,currency,language,address,city,ifu_number,trade_register,promoter_photo_path,identity_card_path,status,created_at")
      .in("id", context.tenantIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: "Impossible de charger vos établissements." }, { status: 500 });
    return NextResponse.json({ companies: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const activityType = typeof body.activityType === "string" ? body.activityType : "";
    const address = typeof body.address === "string" ? body.address.trim().slice(0, 240) : null;
    const city = typeof body.city === "string" ? body.city.trim().slice(0, 120) : null;
    const ifuNumber = typeof body.ifuNumber === "string" ? body.ifuNumber.trim().slice(0, 80) : null;
    const tradeRegister = typeof body.tradeRegister === "string" ? body.tradeRegister.trim().slice(0, 120) : null;

    if (name.length < 2 || !activityTypes.includes(activityType as (typeof activityTypes)[number])) {
      return NextResponse.json({ error: "Nom et type d’établissement valides requis." }, { status: 400 });
    }

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise. Veuillez vous connecter." }, { status: 401 });
    if (context.affiliateId || context.userType === "AFFILIATE") {
      return NextResponse.json({ error: "Un compte affilié ne peut pas créer un établissement. Utilisez un compte propriétaire séparé." }, { status: 403 });
    }
    if (context.employeeId) {
      return NextResponse.json({ error: "Vous êtes actuellement connecté avec un compte employé. Seul un compte propriétaire peut créer un établissement." }, { status: 403 });
    }

    const auth = { user: context.user };
    const countryRaw = typeof body.country === "string" ? body.country.trim() : "";
    const currencyRaw = typeof body.currency === "string" ? body.currency.trim() : "";

    const countryMap: Record<string, string> = { "Côte d’Ivoire": "CI", "Cote d'Ivoire": "CI", "Bénin": "BJ", "Benin": "BJ", "Sénégal": "SN", "Senegal": "SN", "Togo": "TG" };
    const currencyMap: Record<string, string> = { "FCFA": "XOF", "XOF": "XOF", "GHS": "GHS", "NGN": "NGN" };
    const country = countryMap[countryRaw] || (countryRaw.length === 2 ? countryRaw.toUpperCase() : "CI");
    const currency = currencyMap[currencyRaw] || (currencyRaw.length === 3 ? currencyRaw.toUpperCase() : "XOF");

    const cookieStore = await cookies();
    const referralCode = cookieStore.get("dm_affiliate_ref")?.value?.trim().toUpperCase() || "";
    const admin = createSupabaseAdminClient();
    const { data: affiliate } = referralCode
      ? await admin.from("platform_affiliates").select("id,code").eq("code", referralCode).eq("status", "ACTIVE").maybeSingle()
      : { data: null };

    // Generate unique 10-char code
    let uniqueCode = `DM${randomBytes(4).toString("hex").toUpperCase()}`;
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const insertPayload = {
      name,
      activity_type: activityType,
      unique_code: uniqueCode,
      owner_user_id: auth.user.id,
      affiliate_id: affiliate?.id ?? null,
      country,
      currency,
      address: address || null,
      city: city || null,
      ifu_number: ifuNumber || null,
      trade_register: tradeRegister || null,
      status: "TRIAL",
      trial_ends_at: trialEndsAt,
      zones_tables_enabled: true
    };

    let insertResult = await admin
      .from("companies")
      .insert(insertPayload)
      .select("id,name,activity_type,country,currency,language,address,city,ifu_number,trade_register,status,created_at,affiliate_id")
      .single();

    // If code collision, retry once with a fresh code
    if (insertResult.error && insertResult.error.code === "23505") {
      uniqueCode = `DM${randomBytes(4).toString("hex").toUpperCase()}`;
      insertPayload.unique_code = uniqueCode;
      insertResult = await admin
        .from("companies")
        .insert(insertPayload)
        .select("id,name,activity_type,country,currency,language,address,city,ifu_number,trade_register,status,created_at,affiliate_id")
        .single();
    }

    const { data, error } = insertResult;
    if (error || !data) {
      console.error("[companies.POST] Creation failed", { code: error?.code, message: error?.message });
      return NextResponse.json({ error: "Impossible de créer l’établissement. Veuillez vérifier les informations et réessayer." }, { status: 400 });
    }

    // Provision or update owner profile with the newly created tenant
    await admin.from("profiles").upsert({
      id: auth.user.id,
      tenant_id: data.id,
      role: "ADMINISTRATEUR",
      user_type: "TENANT_STAFF",
      status: "ACTIVE"
    }, { onConflict: "id" });

    if (affiliate) {
      const { error: attributionError } = await admin.from("affiliate_attributions").insert({ affiliate_id: affiliate.id, tenant_id: data.id, attribution_code: affiliate.code });
      if (attributionError) console.error("[companies.POST] affiliate attribution failed", { code: attributionError.code });
    }

    const response = NextResponse.json({ company: data, affiliateAttributed: Boolean(affiliate) }, { status: 201 });
    // Set active tenant cookie immediately
    response.cookies.set("debitmanager_active_tenant", data.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });

    if (referralCode) response.cookies.set("dm_affiliate_ref", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0, path: "/" });
    return response;
  } catch (cause) {
    console.error("[companies.POST] unexpected error", cause);
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
