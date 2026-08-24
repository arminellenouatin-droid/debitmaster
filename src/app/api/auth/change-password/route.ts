// DebitManager auth API: staff must replace the temporary password on first access.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";
    const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
    if (password.length < 8 || password !== confirmation) return NextResponse.json({ error: "Les deux mots de passe doivent être identiques et contenir au moins 8 caractères." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) return NextResponse.json({ error: "Impossible de modifier le mot de passe." }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { error: employeeError } = await admin.from("employees").update({ must_change_password: false }).eq("user_id", user.id).eq("status", "ACTIVE").is("deleted_at", null);
    if (employeeError) return NextResponse.json({ error: "Mot de passe modifié, mais le statut du premier accès n’a pas pu être clôturé. Reconnectez-vous puis réessayez." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
