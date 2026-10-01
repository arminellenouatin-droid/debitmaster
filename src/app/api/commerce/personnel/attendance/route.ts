import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? "";
    const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const month = searchParams.get("month"); // optional YYYY-MM
    const employeeId = searchParams.get("employeeId");

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    if (!can(context, "attendance.view") && !can(context, "team.view")) {
      return NextResponse.json({ error: "Permission insuffisante pour consulter les présences." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("commerce_attendance")
      .select(`
        id, tenant_id, employee_id, work_date, check_in_time, check_out_time,
        status, minutes_late, notes, created_at, updated_at,
        commerce_employees (id, first_name, last_name, phone, status)
      `)
      .eq("tenant_id", tenantId);

    if (month) {
      query = query.gte("work_date", `${month}-01`).lte("work_date", `${month}-31`);
    } else if (date) {
      query = query.eq("work_date", date);
    }

    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    const { data, error } = await query.order("work_date", { ascending: false });
    if (error) {
      console.error("[attendance.GET] error", error);
      return NextResponse.json({ error: "Impossible de charger les présences." }, { status: 500 });
    }

    return NextResponse.json({ attendances: data ?? [] });
  } catch (err) {
    console.error("[attendance.GET] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const action = body.action === "CHECK_OUT" ? "CHECK_OUT" : "CHECK_IN";
    const status = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "EXCUSED"].includes(body.status) ? body.status : "PRESENT";
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : null;
    const workDate = typeof body.workDate === "string" ? body.workDate : new Date().toISOString().slice(0, 10);
    const minutesLate = Number(body.minutesLate) >= 0 ? Math.floor(Number(body.minutesLate)) : 0;

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    if (!can(context, "attendance.manage") && !can(context, "team.manage")) {
      return NextResponse.json({ error: "Permission insuffisante pour gérer les pointages." }, { status: 403 });
    }

    if (!employeeId) {
      return NextResponse.json({ error: "Un collaborateur doit être spécifié." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    if (action === "CHECK_OUT") {
      // Find existing today's record and update check_out_time
      const { data: existing } = await admin
        .from("commerce_attendance")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("employee_id", employeeId)
        .eq("work_date", workDate)
        .maybeSingle();

      if (existing) {
        const { data: updated, error: updErr } = await admin
          .from("commerce_attendance")
          .update({
            check_out_time: now,
            notes: notes || undefined,
            updated_at: now,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (updErr) {
          return NextResponse.json({ error: "Impossible de valider la sortie." }, { status: 500 });
        }
        return NextResponse.json({ attendance: updated, message: "Départ enregistré avec succès." });
      }
    }

    // CHECK_IN or Upsert
    const { data: record, error: upsertErr } = await admin
      .from("commerce_attendance")
      .upsert({
        tenant_id: tenantId,
        employee_id: employeeId,
        work_date: workDate,
        check_in_time: now,
        status,
        minutes_late: minutesLate,
        notes,
        recorded_by: context.user.id,
        updated_at: now,
      }, { onConflict: "tenant_id, employee_id, work_date" })
      .select()
      .single();

    if (upsertErr) {
      console.error("[attendance.POST] upsert error", upsertErr);
      return NextResponse.json({ error: "Impossible d'enregistrer le pointage." }, { status: 500 });
    }

    return NextResponse.json({ attendance: record, message: "Pointage enregistré avec succès." });
  } catch (err) {
    console.error("[attendance.POST] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}
