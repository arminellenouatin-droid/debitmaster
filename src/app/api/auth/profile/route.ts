// DebitManager account profile API: only the authenticated user's own profile may be updated.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const body = await request.json();
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (firstName.length < 2 || lastName.length < 2) return NextResponse.json({ error: "Le prénom et le nom doivent contenir au moins 2 caractères." }, { status: 400 });
    if (email && !emailPattern.test(email)) return NextResponse.json({ error: "Saisissez une adresse e-mail valide." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const metadata = { ...user.user_metadata, first_name: firstName, last_name: lastName };
    const { data: updatedAuth, error: authError } = await supabase.auth.updateUser({ ...(email && email !== user.email ? { email } : {}), data: metadata });
    if (authError) return NextResponse.json({ error: "Impossible de mettre à jour les informations du compte." }, { status: 400 });

    const { error: profileError } = await admin.from("profiles").update({ first_name: firstName, last_name: lastName, ...(email ? { email } : {}), updated_at: new Date().toISOString() }).eq("id", user.id);
    if (profileError) return NextResponse.json({ error: "Identité mise à jour côté session, mais le profil n’a pas pu être synchronisé." }, { status: 409 });

    return NextResponse.json({ ok: true, emailConfirmationRequired: Boolean(email && email !== user.email && updatedAuth.user?.email !== email), email: updatedAuth.user?.email ?? email, firstName, lastName });
  } catch {
    return NextResponse.json({ error: "Impossible de mettre à jour le profil pour le moment." }, { status: 500 });
  }
}
