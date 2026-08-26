// DebitManager auth API: inscription publique affiliée, compte séparé des établissements, création serveur sans exposition de la clé de service.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthorizationContext } from "@/lib/authorization";

const randomAffiliateCode = () => `AFF${randomBytes(6).toString("hex").toUpperCase()}`;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!firstName || !lastName || !email.includes("@") || password.length < 8) {
      return errorResponse("Renseignez vos nom et prénom, un e-mail valide et un mot de passe d’au moins 8 caractères.");
    }

    const existingContext = await getAuthorizationContext();
    if (existingContext.user) {
      if (existingContext.affiliateId) return errorResponse("Ce compte est déjà affilié. Ouvrez votre espace affilié.", 409);
      if (existingContext.employeeId || existingContext.tenantIds.length) return errorResponse("Ce compte est déjà rattaché à un établissement. Utilisez un compte affilié séparé.", 409);
      return errorResponse("Ce compte est déjà connecté. Utilisez l’adhésion d’un compte existant.", 409);
    }

    const admin = createSupabaseAdminClient();
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone: phone || undefined,
      user_metadata: { first_name: firstName, last_name: lastName, phone, user_type: "AFFILIATE", role: "AFFILIATE" },
    });
    if (created.error || !created.data.user) {
      const message = created.error?.message?.toLowerCase().includes("already") || created.error?.message?.toLowerCase().includes("exists")
        ? "Cet e-mail est déjà utilisé. Utilisez l’onglet de connexion."
        : "Impossible de créer le compte affilié.";
      return errorResponse(message, 400);
    }

    const userId = created.data.user.id;
    const code = randomAffiliateCode();
    const profile = await admin.from("profiles").upsert({
      id: userId,
      tenant_id: null,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      email,
      user_type: "AFFILIATE",
      role: "AFFILIATE",
      status: "ACTIVE",
      must_change_password: false,
      deleted_at: null,
    }, { onConflict: "id" });
    if (profile.error) {
      await admin.auth.admin.deleteUser(userId);
      return errorResponse("Impossible de créer le profil affilié.", 500);
    }

    const affiliate = await admin.from("platform_affiliates").insert({
      user_id: userId,
      code,
      display_name: `${firstName} ${lastName}`.trim(),
      commission_rate: 10,
      payout_threshold_xof: 20000,
      status: "ACTIVE",
    }).select("id,code,display_name,commission_rate,payout_threshold_xof,status").single();
    if (affiliate.error || !affiliate.data) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return errorResponse(affiliate.error?.code === "23505" ? "Un compte affilié existe déjà avec ces informations." : "Impossible d’activer le compte affilié.", 500);
    }

    const supabase = await createSupabaseServerClient();
    const session = await supabase.auth.signInWithPassword({ email, password });
    if (session.error || !session.data.user) {
      return NextResponse.json({ affiliate: affiliate.data, needsLogin: true, message: "Compte affilié créé. Connectez-vous pour ouvrir votre espace." }, { status: 201 });
    }

    return NextResponse.json({ affiliate: affiliate.data, space: "AFFILIATE" }, { status: 201 });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "unknown_error";
    console.error("[affiliate signup] server failure:", detail);
    if (detail.startsWith("Configuration Supabase")) return errorResponse("Le service d’affiliation n’est pas encore configuré sur la production.", 503);
    return errorResponse("Impossible de terminer l’inscription affiliée pour le moment.", 500);
  }
}
