// DebitManager tenant API: toutes les opérations sont bornées par l’utilisateur Supabase courant.
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizationContext } from "@/lib/authorization";

const activityTypes = ["BUVETTE", "BAR_RESTAURANT", "NIGHTCLUB_LOUNGE"] as const;

export async function GET() {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.length) return NextResponse.json({ companies: [] });
    const { data, error } = await context.supabase
      .from("companies")
      .select("id,name,activity_type,country,currency,language,status,created_at")
      .in("id", context.tenantIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: "Impossible de charger vos établissements." }, { status: 500 });
    return NextResponse.json({ companies: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const activityType = typeof body.activityType === "string" ? body.activityType : "";
    if (name.length < 2 || !activityTypes.includes(activityType as (typeof activityTypes)[number])) return NextResponse.json({ error: "Nom et type d’établissement valides requis." }, { status: 400 });

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (context.employeeId) return NextResponse.json({ error: "Seul le propriétaire peut créer un établissement." }, { status: 403 });
    const supabase = context.supabase;
    const auth = { user: context.user };
    const uniqueCode = `DM${randomBytes(4).toString("hex").toUpperCase()}`;
    const { data, error } = await supabase.from("companies").insert({ name, activity_type: activityType, unique_code: uniqueCode, owner_user_id: auth.user.id }).select("id,name,activity_type,country,currency,language,status,created_at").single();
    if (error) {
      console.error("[companies.POST] Supabase insert failed", { code: error.code, hint: error.hint, message: error.message });
      const diagnostic = error.code === "42501" ? "TENANT_PERMISSION_DENIED" : error.code === "23505" ? "COMPANY_CODE_ALREADY_EXISTS" : error.code === "23502" ? "COMPANY_REQUIRED_FIELD_MISSING" : error.code === "23514" ? "COMPANY_INVALID_VALUE" : error.code === "23503" ? "COMPANY_REFERENCE_INVALID" : "COMPANY_CREATE_FAILED";
      return NextResponse.json({ error: "Impossible de créer l’établissement. Vérifiez les permissions du tenant.", diagnostic }, { status: 400 });
    }
    return NextResponse.json({ company: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
