// DebitManager auth API: adhésion explicite d’un compte existant au programme affilié, uniquement si le compte n’est rattaché à aucun établissement.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthorizationContext } from "@/lib/authorization";

const randomAffiliateCode = () => `AFF${randomBytes(6).toString("hex").toUpperCase()}`;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST() {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return errorResponse("Authentification requise.", 401);
    if (context.isPlatformAdmin || context.userType === "SUPER_ADMIN") return errorResponse("Un compte d’administration SaaS ne peut pas rejoindre le programme affilié.", 403);
    if (context.affiliateId) return NextResponse.json({ space: "AFFILIATE", affiliateId: context.affiliateId });
    if (context.employeeId || context.tenantIds.length) return errorResponse("Ce compte est déjà rattaché à un établissement. Utilisez un compte affilié séparé.", 409);

    const admin = createSupabaseAdminClient();
    const { data: existingProfile } = await admin.from("profiles").select("first_name,last_name,phone,email,user_type,role,status,tenant_id").eq("id", context.user.id).maybeSingle();
    if (existingProfile?.tenant_id || existingProfile?.user_type === "TENANT_STAFF") return errorResponse("Ce compte est déjà réservé à un établissement.", 409);

    const firstName = existingProfile?.first_name || (typeof context.user.user_metadata?.first_name === "string" ? context.user.user_metadata.first_name : "");
    const lastName = existingProfile?.last_name || (typeof context.user.user_metadata?.last_name === "string" ? context.user.user_metadata.last_name : "");
    const displayName = `${firstName} ${lastName}`.trim() || context.user.email?.split("@")[0] || "Affilié DebitManager";
    const existingAffiliate = await admin.from("platform_affiliates").select("id,code,display_name,commission_rate,payout_threshold_xof,status").eq("user_id", context.user.id).maybeSingle();
    if (existingAffiliate.data?.status === "SUSPENDED") return errorResponse("Votre accès au programme affilié est suspendu. Contactez DebitManager.", 403);
    if (existingAffiliate.data) return NextResponse.json({ affiliate: existingAffiliate.data, space: "AFFILIATE" });

    const affiliate = await admin.from("platform_affiliates").insert({
      user_id: context.user.id,
      code: randomAffiliateCode(),
      display_name: displayName,
      commission_rate: 10,
      payout_threshold_xof: 20000,
      status: "ACTIVE",
    }).select("id,code,display_name,commission_rate,payout_threshold_xof,status").single();
    if (affiliate.error || !affiliate.data) return errorResponse("Impossible d’activer votre compte affilié.", 500);

    const profile = await admin.from("profiles").upsert({
      id: context.user.id,
      tenant_id: null,
      first_name: firstName || displayName,
      last_name: lastName || null,
      phone: existingProfile?.phone || context.user.phone || null,
      email: existingProfile?.email || context.user.email || null,
      user_type: "AFFILIATE",
      role: "AFFILIATE",
      status: "ACTIVE",
      must_change_password: false,
      deleted_at: null,
    }, { onConflict: "id" });
    if (profile.error) {
      await admin.from("platform_affiliates").delete().eq("id", affiliate.data.id);
      return errorResponse("Impossible d’enregistrer votre profil affilié.", 500);
    }

    return NextResponse.json({ affiliate: affiliate.data, space: "AFFILIATE" }, { status: 201 });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "unknown_error";
    console.error("[affiliate join] server failure:", detail);
    if (detail.startsWith("Configuration Supabase")) return errorResponse("Le service d’affiliation n’est pas encore configuré sur la production.", 503);
    return errorResponse("Impossible de rejoindre le programme affilié pour le moment.", 500);
  }
}
