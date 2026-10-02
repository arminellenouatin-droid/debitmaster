import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import {
  verifySiteGeofence,
  detectAbsenceIncident,
} from "@/lib/couture-staff-incentives";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const employeeId = searchParams.get("employeeId");
    const date = searchParams.get("date");
    const siteId = searchParams.get("siteId");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "attendance.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_attendance_logs")
      .select(`
        *,
        employee:couture_employees!employee_id (id, full_name, email, phone),
        site:couture_sites!site_id (id, name, site_type, city)
      `)
      .eq("tenant_id", context.tenantId)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (employeeId) query = query.eq("employee_id", employeeId);
    if (date) query = query.eq("log_date", date);
    if (siteId) query = query.eq("site_id", siteId);

    const { data: logs, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Impossible de charger les pointages de présence." }, { status: 500 });
    }

    // Incidents de présence non résolus
    const { data: incidents } = await admin
      .from("couture_attendance_incidents")
      .select(`
        *,
        employee:couture_employees!employee_id (id, full_name)
      `)
      .eq("tenant_id", context.tenantId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      logs: logs ?? [],
      activeIncidents: incidents ?? [],
    });
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

    assertCouturePermission(context, "attendance.track");

    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const action = String(body.action || "CHECK_IN").toUpperCase(); // "CHECK_IN", "CHECK_OUT", "HEARTBEAT"
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Math.max(1, Number(body.accuracyMeters) || 10);
    const awayMinutes = Math.max(0, Number(body.awayMinutes) || 0);

    if (!employeeId || !siteId) {
      return NextResponse.json({ error: "Identifiant employé et site obligatoires." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Coordonnées de référence du site (par défaut si non configuré)
    const { data: site } = await admin
      .from("couture_sites")
      .select("*")
      .eq("id", siteId)
      .eq("tenant_id", context.tenantId)
      .single();

    if (!site) {
      return NextResponse.json({ error: "Site introuvable." }, { status: 404 });
    }

    // Coordonnées du site (ex: Lomé ~ 6.137, 1.212 par défaut)
    const siteLat = Number(site.latitude) || 6.137;
    const siteLng = Number(site.longitude) || 1.212;

    let distanceMeters = 0;
    let isWithinSite = true;

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const geoCheck = verifySiteGeofence(siteLat, siteLng, latitude, longitude, 300);
      distanceMeters = geoCheck.distanceMeters;
      isWithinSite = geoCheck.isWithinGeofence;
    }

    // 2. Vérification incident d'éloignement > 15 minutes
    const absenceCheck = detectAbsenceIncident(awayMinutes);
    let createdIncident = null;

    if (absenceCheck.isIncident || (!isWithinSite && action === "CHECK_IN")) {
      const incidentType = absenceCheck.isIncident ? "AWAY_OVER_15_MIN" : "LOCATION_MISMATCH";
      const desc = absenceCheck.isIncident
        ? `Éloignement de plus de ${awayMinutes} minutes constaté sans autorisation préalable.`
        : `Tentative de pointage hors zone du site (distance : ${distanceMeters} m).`;

      const { data: incident } = await admin
        .from("couture_attendance_incidents")
        .insert({
          tenant_id: context.tenantId,
          employee_id: employeeId,
          site_id: siteId,
          incident_type: incidentType,
          away_minutes: awayMinutes,
          description: desc,
          resolved: false,
        })
        .select()
        .single();

      createdIncident = incident;
    }

    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // 3. Enregistrement ou mise à jour du pointage
    let attendanceLog = null;

    if (action === "CHECK_IN") {
      const { data: log, error: logErr } = await admin
        .from("couture_attendance_logs")
        .insert({
          tenant_id: context.tenantId,
          employee_id: employeeId,
          site_id: siteId,
          log_date: today,
          check_in_time: nowIso,
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          accuracy_meters: accuracy,
          distance_from_site_meters: distanceMeters,
          status: isWithinSite ? "ON_SITE" : "OFF_SITE",
        })
        .select()
        .single();

      if (logErr) {
        return NextResponse.json({ error: "Erreur lors de l'enregistrement de l'arrivée." }, { status: 500 });
      }
      attendanceLog = log;
    } else if (action === "CHECK_OUT") {
      const { data: updatedLog } = await admin
        .from("couture_attendance_logs")
        .update({
          check_out_time: nowIso,
        })
        .eq("employee_id", employeeId)
        .eq("log_date", today)
        .eq("tenant_id", context.tenantId)
        .select()
        .maybeSingle();

      attendanceLog = updatedLog;
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: "couture.attendance.track",
      entityType: "couture_attendance_logs",
      entityId: employeeId,
      metadata: {
        action,
        distanceMeters,
        isWithinSite,
        hasIncident: Boolean(createdIncident),
      },
    });

    return NextResponse.json({
      success: true,
      action,
      isWithinSite,
      distanceMeters,
      incident: createdIncident,
      attendance: attendanceLog,
      message: absenceCheck.shouldDisconnect
        ? "Attention : Déconnexion automatique pour absence prolongée (> 15 min)."
        : "Pointage de présence enregistré avec succès.",
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
