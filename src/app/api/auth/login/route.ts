// DebitManager auth API: email or phone login, with server-side approval enforcement for staff accounts.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizePhone(value: string) {
  const phone = value.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const isEmail = identifier.includes("@");
    const email = isEmail ? identifier.toLowerCase() : "";
    const phone = isEmail ? "" : normalizePhone(identifier);
    if ((!email || !email.includes("@")) && !phone) return NextResponse.json({ error: "Renseignez un e-mail ou un téléphone international valide." }, { status: 400 });
    if (!password) return NextResponse.json({ error: "Renseignez votre mot de passe." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(email ? { email, password } : { phone, password });
    if (error || !data.user) return NextResponse.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });

    const { data: employee } = await supabase.from("employees").select("status,must_change_password").eq("user_id", data.user.id).is("deleted_at", null).maybeSingle();
    if (employee && employee.status !== "ACTIVE") {
      await supabase.auth.signOut();
      return NextResponse.json({ error: employee.status === "PENDING" ? "Votre demande est en attente de validation par le propriétaire de l’établissement." : "Votre accès à cet établissement n’est pas actif." }, { status: 403 });
    }
    const { data: pendingRequest } = await supabase.from("employee_access_requests").select("status").eq("user_id", data.user.id).order("requested_at", { ascending: false }).limit(1).maybeSingle();
    const { data: profile } = await supabase.from("profiles").select("user_type,role,must_change_password").eq("id", data.user.id).maybeSingle();
    if (!employee && pendingRequest && pendingRequest.status !== "APPROVED") {
      await supabase.auth.signOut();
      return NextResponse.json({ error: pendingRequest.status === "PENDING" ? "Votre demande est en attente de validation par le propriétaire de l’établissement." : "Votre demande d’accès a été refusée." }, { status: 403 });
    }
    const mustChangePassword = Boolean(employee?.must_change_password || profile?.must_change_password);
    const space = profile?.user_type === "SUPER_ADMIN" && profile.role === "MASTER_ADMIN" ? "MASTER_ADMIN" : profile?.user_type === "AFFILIATE" ? "AFFILIATE" : "TENANT";
    return NextResponse.json({ user: data.user, mustChangePassword, space });
  } catch {
    return NextResponse.json({ error: "Impossible de vous connecter pour le moment." }, { status: 500 });
  }
}
