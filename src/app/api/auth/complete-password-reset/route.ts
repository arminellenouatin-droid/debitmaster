import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const recoveryCookie = "dm-password-recovery";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";
    const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
    if (password.length < 8 || password.length > 128 || password !== confirmation) {
      return NextResponse.json({ error: "Les deux mots de passe doivent être identiques et contenir au moins 8 caractères." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const recoveryUserId = cookieStore.get(recoveryCookie)?.value;
    if (!recoveryUserId) return NextResponse.json({ error: "Le lien de réinitialisation est invalide ou expiré. Demandez-en un nouveau." }, { status: 401 });

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || recoveryUserId !== user.id) return NextResponse.json({ error: "Le lien de réinitialisation est invalide ou expiré. Demandez-en un nouveau." }, { status: 401 });

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return NextResponse.json({ error: "Impossible de modifier le mot de passe. Vérifiez les exigences puis réessayez." }, { status: 400 });

    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
    if (signOutError) await supabase.auth.signOut();

    const response = NextResponse.json({ ok: true });
    response.cookies.set(recoveryCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
