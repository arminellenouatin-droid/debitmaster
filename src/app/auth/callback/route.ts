// DebitManager auth callback: échange du code Supabase et redirection vers une destination locale sûre.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  let safeNext = "/dashboard";
  try {
    const requestedNext = new URL(next ?? "/dashboard", url.origin);
    if (requestedNext.origin === url.origin) safeNext = `${requestedNext.pathname}${requestedNext.search}${requestedNext.hash}`;
  } catch {
    // Les destinations malformées restent sur la destination locale par défaut.
  }
  if (!code) return NextResponse.redirect(new URL("/connexion?error=confirmation_invalide", url.origin));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/connexion?error=confirmation_expiree", url.origin));
  const response = NextResponse.redirect(new URL(safeNext, url.origin));
  if (safeNext === "/mot-de-passe/reinitialiser" && data.user?.id) {
    response.cookies.set("dm-password-recovery", data.user.id, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
  }
  return response;
}
