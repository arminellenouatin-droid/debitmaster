import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { defaultDistinctionPieceworkRates } from "@/lib/couture-piecework";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "piecework.view");

    const admin = createSupabaseAdminClient();
    const { data: queriedRates, error } = await admin
      .from("couture_piecework_rates")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("is_active", true)
      .order("task_label", { ascending: true });

    let rates = queriedRates;

    // Auto-seed si vide
    if (!error && (!rates || rates.length === 0)) {
      const toSeed = defaultDistinctionPieceworkRates.map((r) => ({
        tenant_id: context.tenantId,
        task_code: r.taskCode,
        task_label: r.taskLabel,
        rate_without_embroidery_xof: r.rateWithoutEmbroideryXof,
        rate_with_embroidery_xof: r.rateWithEmbroideryXof,
        is_active: true,
      }));
      const { data: seeded } = await admin
        .from("couture_piecework_rates")
        .insert(toSeed)
        .select();
      rates = seeded ?? [];
    }

    return NextResponse.json({ rates: rates ?? [] });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "piecework.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const taskCode = typeof body.taskCode === "string" ? body.taskCode.trim().toUpperCase() : "";
    const taskLabel = typeof body.taskLabel === "string" ? body.taskLabel.trim().slice(0, 120) : "";
    const rateWithoutEmbroidery = Math.max(0, Math.floor(Number(body.rateWithoutEmbroideryXof) || 0));
    const rateWithEmbroidery = Math.max(0, Math.floor(Number(body.rateWithEmbroideryXof) || rateWithoutEmbroidery));

    if (taskCode.length < 2 || taskLabel.length < 2) {
      return NextResponse.json({ error: "Code tâche et libellé requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: rate, error } = await admin
      .from("couture_piecework_rates")
      .upsert(
        {
          tenant_id: context.tenantId,
          task_code: taskCode,
          task_label: taskLabel,
          rate_without_embroidery_xof: rateWithoutEmbroidery,
          rate_with_embroidery_xof: rateWithEmbroidery,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,task_code" }
      )
      .select()
      .single();

    if (error || !rate) {
      return NextResponse.json({ error: "Impossible d'enregistrer le tarif de tâche." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.piecework.rate_upsert",
      entityType: "couture_piecework_rates",
      entityId: rate.id,
      metadata: {
        taskCode,
        rateWithoutEmbroidery,
        rateWithEmbroidery,
      },
    });

    return NextResponse.json({ rate }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
