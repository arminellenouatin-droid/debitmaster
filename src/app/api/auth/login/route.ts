// DebitManager auth API: connexion serveur, validation explicite et erreurs non révélatrices.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !email.includes("@") || !password) {
      return NextResponse.json({ error: "Renseignez un e-mail et un mot de passe." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });
    return NextResponse.json({ user: data.user });
  } catch {
    return NextResponse.json({ error: "Impossible de vous connecter pour le moment." }, { status: 500 });
  }
}
