// DebitManager auth API: inscription serveur, validation d’entrée et session stockée par Supabase SSR.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const invitationToken = typeof body.invitationToken === "string" ? body.invitationToken.trim() : "";
    const affiliateCode = typeof body.affiliateCode === "string" ? body.affiliateCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 40) : "";

    if (!email || !email.includes("@") || password.length < 8 || !firstName || !lastName) {
      return NextResponse.json({ error: "Renseignez un nom complet, un e-mail valide et un mot de passe d’au moins 8 caractères." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, phone } },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const withReferralCookie = (response: NextResponse) => {
      if (affiliateCode) response.cookies.set("dm_affiliate_ref", affiliateCode, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
      return response;
    };
    if (data.session && /^[a-f0-9]{64}$/i.test(invitationToken)) {
      const { error: invitationError } = await supabase.rpc("accept_employee_invitation", { p_token_hash: createHash("sha256").update(invitationToken).digest("hex") });
      if (invitationError) return withReferralCookie(NextResponse.json({ user: data.user, invitationPending: true, error: "Compte créé. Connectez-vous avec cette adresse puis revenez sur le lien d’invitation pour finaliser le rattachement." }, { status: 202 }));
      return withReferralCookie(NextResponse.json({ user: data.user, invitationAccepted: true, needsEmailConfirmation: false }));
    }
    return withReferralCookie(NextResponse.json({ user: data.user, needsEmailConfirmation: !data.session, invitationPending: /^[a-f0-9]{64}$/i.test(invitationToken) }));
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "unknown_error";
    console.error("[DebitManager signup] server failure:", detail);
    const configurationError = detail.startsWith("Configuration Supabase absente");
    return NextResponse.json({ error: configurationError ? "Le service d’inscription n’est pas encore configuré sur la production." : "Impossible de terminer l’inscription pour le moment." }, { status: configurationError ? 503 : 500 });
  }
}
