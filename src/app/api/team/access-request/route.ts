// DebitManager staff access: a company code creates a pending request, never an active tenant session.
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneIdentifier, syntheticEmailForPhone } from "@/lib/auth-identifiers";

const positions = ["SERVEUR", "SUPERVISEUR", "MAGASINIER", "GERANT", "BARMAN", "SECRETAIRE", "COMPTABLE", "APPROVISIONNEMENT", "CUISINIER", "CHEF_CUISINE"] as const;

function normalizePhone(value: string) { return normalizePhoneIdentifier(value); }

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyCode = typeof body.companyCode === "string" ? body.companyCode.trim().toUpperCase() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const position = typeof body.position === "string" ? body.position : "";
    if (!companyCode || firstName.length < 2 || lastName.length < 2 || !phone || password.length < 8 || !positions.includes(position as (typeof positions)[number])) return NextResponse.json({ error: "Code établissement, identité, téléphone international, rôle et mot de passe valides requis." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: company, error: companyError } = await admin.from("companies").select("id,name").eq("unique_code", companyCode).is("deleted_at", null).maybeSingle();
    if (companyError || !company) return NextResponse.json({ error: "Code établissement invalide." }, { status: 400 });

    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email: syntheticEmailForPhone(phone), phone, password, email_confirm: true, phone_confirm: true, user_metadata: { first_name: firstName, last_name: lastName, account_type: "STAFF_PENDING" } });
    if (authError || !authData.user) return NextResponse.json({ error: "Impossible de créer ce compte téléphone. Vérifiez que le numéro n’est pas déjà utilisé." }, { status: 400 });

    const { error: profileError } = await admin.from("profiles").upsert({ id: authData.user.id, tenant_id: null, first_name: firstName, last_name: lastName, phone, user_type: "TENANT_STAFF", role: position, status: "PENDING" });
    const { error: requestError } = await admin.from("employee_access_requests").insert({ tenant_id: company.id, user_id: authData.user.id, phone, first_name: firstName, last_name: lastName, position, status: "PENDING" });
    if (profileError || requestError) {
      await admin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Impossible d’enregistrer la demande d’accès." }, { status: 400 });
    }
    return NextResponse.json({ status: "PENDING", companyName: company.name, message: "Votre demande est enregistrée. Le propriétaire doit valider votre accès avant votre première connexion." }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
