// DebitManager: invitation acceptance remains server-side and never exposes the stored token hash.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorMessages: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "Connectez-vous ou créez votre compte avant d’accepter cette invitation.",
  INVITATION_INVALID_OR_EXPIRED: "Cette invitation est invalide, déjà utilisée ou expirée.",
  INVITATION_EMAIL_MISMATCH: "Le compte connecté n’utilise pas l’adresse e-mail invitée.",
  ACCOUNT_ALREADY_LINKED: "Ce compte est déjà rattaché à un autre établissement.",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ error: "Jeton d’invitation invalide." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: sessionData } = await supabase.auth.getUser();
    if (!sessionData.user) {
      return NextResponse.json({ error: errorMessages.AUTHENTICATION_REQUIRED, code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    let admin;
    try {
      admin = createSupabaseAdminClient();
    } catch {
      return NextResponse.json({ error: "Le service d’acceptation d’invitation n’est pas configuré sur le serveur." }, { status: 503 });
    }
    const { data, error } = await admin.rpc("accept_employee_invitation", {
      p_token_hash: tokenHash,
      p_user_id: sessionData.user.id,
      p_email: sessionData.user.email ?? "",
    });
    if (error) {
      const code = error.message.match(/(AUTHENTICATION_REQUIRED|INVITATION_INVALID_OR_EXPIRED|INVITATION_EMAIL_MISMATCH|ACCOUNT_ALREADY_LINKED)/)?.[1] ?? "INVITATION_ACCEPTANCE_FAILED";
      return NextResponse.json({ error: errorMessages[code] ?? "Impossible d’accepter cette invitation.", code }, { status: code === "INVITATION_INVALID_OR_EXPIRED" ? 410 : 400 });
    }

    return NextResponse.json({ accepted: true, employee: data?.[0] ?? null });
  } catch {
    return NextResponse.json({ error: "Requête d’acceptation invalide." }, { status: 400 });
  }
}
