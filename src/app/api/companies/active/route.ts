// DebitManager tenant context: persist only a server-validated tenant id in an httpOnly cookie.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthorizationContext } from "@/lib/authorization";
import { ACTIVE_TENANT_COOKIE } from "@/lib/active-tenant";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (!tenantId) return NextResponse.json({ error: "Établissement requis." }, { status: 400 });

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ activeTenantId: tenantId });
  } catch {
    return NextResponse.json({ error: "Impossible de sélectionner cet établissement." }, { status: 400 });
  }
}
