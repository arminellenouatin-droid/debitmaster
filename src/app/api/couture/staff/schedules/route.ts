import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const siteId = searchParams.get("siteId");
    const staffCategory = searchParams.get("staffCategory");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "hr.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_work_schedules")
      .select(`
        *,
        site:couture_sites!site_id (id, name, site_type, city)
      `)
      .eq("tenant_id", context.tenantId)
      .order("day_of_week", { ascending: true });

    if (siteId) query = query.eq("site_id", siteId);
    if (staffCategory && ["BOUTIQUE", "ADMIN", "ATELIER"].includes(staffCategory)) {
      query = query.eq("staff_category", staffCategory);
    }

    const { data: schedules, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les plannings de travail." }, { status: 500 });
    }

    return NextResponse.json({ schedules: schedules ?? [] });
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

    assertCouturePermission(context, "hr.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : null;
    const staffCategory = ["BOUTIQUE", "ADMIN", "ATELIER"].includes(body.staffCategory)
      ? body.staffCategory
      : "BOUTIQUE";
    const dayOfWeek = Math.min(6, Math.max(0, Number(body.dayOfWeek) || 1));
    const isDayOff = Boolean(body.isDayOff);

    const admin = createSupabaseAdminClient();

    const scheduleData = {
      tenant_id: context.tenantId,
      site_id: siteId,
      staff_category: staffCategory,
      day_of_week: dayOfWeek,
      morning_start_time: body.morningStartTime || null,
      morning_end_time: body.morningEndTime || null,
      afternoon_start_time: body.afternoonStartTime || null,
      afternoon_end_time: body.afternoonEndTime || null,
      evening_start_time: body.eveningStartTime || null,
      evening_end_time: body.eveningEndTime || null,
      is_day_off: isDayOff,
    };

    const { data: schedule, error: upsertErr } = await admin
      .from("couture_work_schedules")
      .upsert(scheduleData, {
        onConflict: "tenant_id, site_id, staff_category, day_of_week",
      })
      .select()
      .single();

    if (upsertErr || !schedule) {
      return NextResponse.json({ error: "Impossible d'enregistrer le planning." }, { status: 500 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.hr.schedule_update",
      entityType: "couture_work_schedules",
      entityId: schedule.id,
      metadata: { staffCategory, dayOfWeek, isDayOff },
    });

    return NextResponse.json({ schedule }, { status: 200 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
