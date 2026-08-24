// DebitManager auth API: inscription serveur, validation d’entrée et session stockée par Supabase SSR.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

    if (!email || !email.includes("@") || password.length < 8 || !firstName || !lastName) {
      return NextResponse.json({ error: "Renseignez un nom complet, un e-mail valide et un mot de passe d’au moins 8 caractères." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: data.user, needsEmailConfirmation: !data.session });
  } catch {
    return NextResponse.json({ error: "Impossible de terminer l’inscription pour le moment." }, { status: 500 });
  }
}
