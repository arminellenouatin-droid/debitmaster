// DebitManager auth API: email or phone login, with server-side approval enforcement for staff accounts.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneIdentifier, syntheticEmailForPhone } from "@/lib/auth-identifiers";

function normalizePhone(value: string) { return normalizePhoneIdentifier(value); }

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
    let resolvedEmail = "";
    if (phone) {
      try {
        const admin = createSupabaseAdminClient();
        const [{ data: employees }, { data: profiles }] = await Promise.all([
          admin.from("employees").select("user_id,tenant_id").eq("phone", phone).eq("status", "ACTIVE").is("deleted_at", null).limit(2),
          admin.from("profiles").select("id,tenant_id").eq("phone", phone).eq("status", "ACTIVE").limit(2),
        ]);
        const userIds = Array.from(new Set([...(employees ?? []).map((row) => row.user_id), ...(profiles ?? []).map((row) => row.id)].filter(Boolean)));
        if (userIds.length > 1) return NextResponse.json({ error: "Ce numéro est associé à plusieurs établissements. Utilisez l’e-mail du compte ou demandez une régularisation." }, { status: 409 });
        if (userIds[0]) {
          const { data: authUser } = await admin.auth.admin.getUserById(userIds[0]);
          resolvedEmail = authUser.user?.email ?? "";
        }
      } catch {
        // Le fallback ne révèle pas si un compte existe ; les nouveaux comptes utilisent l’alias interne.
      }
    }
    const authInputs: Array<{ email: string; password: string } | { phone: string; password: string }> = email
      ? [{ email, password }]
      : [{ email: resolvedEmail || syntheticEmailForPhone(phone), password }];
    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] = { user: null, session: null };
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] = null;
    for (const authInput of authInputs) {
      const attempt = await supabase.auth.signInWithPassword(authInput);
      data = attempt.data;
      error = attempt.error;
      if (data.user) break;
    }
    if (error || !data.user) return NextResponse.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });

    const { data: employee } = await supabase.from("employees").select("status,must_change_password").eq("user_id", data.user.id).is("deleted_at", null).maybeSingle();
    if (employee && employee.status !== "ACTIVE") {
      await supabase.auth.signOut();
      return NextResponse.json({ error: employee.status === "PENDING" ? "Votre demande est en attente de validation par le propriétaire de l’établissement." : "Votre accès à cet établissement n’est pas actif." }, { status: 403 });
    }
    const { data: pendingRequest } = await supabase.from("employee_access_requests").select("status").eq("user_id", data.user.id).order("requested_at", { ascending: false }).limit(1).maybeSingle();
    const { data: profile } = await supabase.from("profiles").select("user_type,role,must_change_password,status").eq("id", data.user.id).maybeSingle();
    if (profile?.user_type === "AFFILIATE") {
      const { data: affiliate } = await supabase.from("platform_affiliates").select("status").eq("user_id", data.user.id).maybeSingle();
      if (affiliate?.status !== "ACTIVE") {
        await supabase.auth.signOut();
        return NextResponse.json({ error: "Votre accès au programme affilié n’est pas actif." }, { status: 403 });
      }
    }
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
