// DebitMaster: Enregistrement sécurisé du jeton Web Push Chrome avec isolation tenant et contrôle d'accès.

import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";

export async function POST(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = (await request.json()) as {
      tenantId?: string;
      token?: string;
      deviceType?: string;
    };

    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const deviceType = typeof body.deviceType === "string" ? body.deviceType : "CHROME_WEB";

    if (!tenantId || !token) {
      return NextResponse.json(
        { error: "Identifiant d'établissement et jeton de notification requis." },
        { status: 400 }
      );
    }

    if (!context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const userAgent = request.headers.get("user-agent") ?? null;

    const { error } = await context.supabase.from("user_push_tokens").upsert(
      {
        tenant_id: tenantId,
        user_id: context.user.id,
        token,
        device_type: deviceType,
        user_agent: userAgent,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

    if (error) {
      console.error("[FCM] Erreur enregistrement token push:", error.message);
      return NextResponse.json({ error: "Impossible d'enregistrer les notifications." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      tenantId?: string;
      token?: string;
    };

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Jeton requis." }, { status: 400 });
    }

    const { error } = await context.supabase
      .from("user_push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("token", token)
      .eq("user_id", context.user.id);

    if (error) {
      return NextResponse.json({ error: "Impossible de désactiver les notifications." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
