import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";
import { generateMonthlyPayrollNumber } from "@/lib/couture-staff-incentives";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const periodYear = searchParams.get("periodYear");
    const periodMonth = searchParams.get("periodMonth");
    const employeeId = searchParams.get("employeeId");

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "payroll.view");

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_monthly_payrolls")
      .select(`
        *,
        employee:couture_employees!employee_id (id, full_name, email, phone)
      `)
      .eq("tenant_id", context.tenantId)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });

    if (periodYear) query = query.eq("period_year", Number(periodYear));
    if (periodMonth) query = query.eq("period_month", Number(periodMonth));
    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data: payrolls, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Impossible de charger les fiches de paie mensuelles." }, { status: 500 });
    }

    return NextResponse.json({ payrolls: payrolls ?? [] });
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

    const action = String(body.action || "CREATE").toUpperCase();
    const admin = createSupabaseAdminClient();

    if (action === "CREATE") {
      assertCouturePermission(context, "payroll.calculate");

      const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
      const periodYear = Number(body.periodYear) || new Date().getFullYear();
      const periodMonth = Number(body.periodMonth) || new Date().getMonth() + 1;
      const baseSalary = Math.max(0, Math.round(Number(body.baseSalary) || 0));
      const primesAmount = Math.max(0, Math.round(Number(body.primesAmount) || 0));
      const deductionsAmount = Math.max(0, Math.round(Number(body.deductionsAmount) || 0));
      const netPay = Math.max(0, baseSalary + primesAmount - deductionsAmount);
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null;

      if (!employeeId) {
        return NextResponse.json({ error: "Employé requis pour le décompte de paie." }, { status: 400 });
      }

      // Numéro séquentiel PAY-YYYY-XXXXXX
      const { count } = await admin
        .from("couture_monthly_payrolls")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", context.tenantId)
        .like("payroll_number", `PAY-${periodYear}-%`);

      const sequence = (count ?? 0) + 1;
      const payrollNumber = generateMonthlyPayrollNumber(sequence, periodYear);

      const { data: payroll, error: insertErr } = await admin
        .from("couture_monthly_payrolls")
        .insert({
          tenant_id: context.tenantId,
          employee_id: employeeId,
          payroll_number: payrollNumber,
          period_year: periodYear,
          period_month: periodMonth,
          base_salary: baseSalary,
          primes_amount: primesAmount,
          deductions_amount: deductionsAmount,
          net_pay: netPay,
          status: "DRAFT",
          notes,
        })
        .select()
        .single();

      if (insertErr || !payroll) {
        return NextResponse.json({ error: "Impossible de créer le décompte de paie mensuelle." }, { status: 500 });
      }

      await writeCoutureAuditEvent({
        tenantId: context.tenantId,
        actorUserId: context.user.id,
        action: "couture.payroll.monthly_create",
        entityType: "couture_monthly_payrolls",
        entityId: payroll.id,
        metadata: { payrollNumber, employeeId, netPay },
      });

      return NextResponse.json({ payroll }, { status: 201 });
    }

    if (action === "APPROVE") {
      assertCouturePermission(context, "payroll.approve");

      const payrollId = typeof body.payrollId === "string" ? body.payrollId.trim() : "";
      if (!payrollId) {
        return NextResponse.json({ error: "Identifiant du décompte de paie requis." }, { status: 400 });
      }

      const { data: approvedPayroll, error: appErr } = await admin
        .from("couture_monthly_payrolls")
        .update({
          status: "APPROVED",
          approved_by: context.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", payrollId)
        .eq("tenant_id", context.tenantId)
        .select()
        .single();

      if (appErr || !approvedPayroll) {
        return NextResponse.json({ error: "Impossible d'approuver le décompte de paie." }, { status: 500 });
      }

      await writeCoutureAuditEvent({
        tenantId: context.tenantId,
        actorUserId: context.user.id,
        action: "couture.payroll.monthly_approve",
        entityType: "couture_monthly_payrolls",
        entityId: payrollId,
        metadata: { payrollNumber: approvedPayroll.payroll_number },
      });

      return NextResponse.json({ payroll: approvedPayroll, message: "Décompte mensuel approuvé avec succès." });
    }

    return NextResponse.json({ error: "Action invalide (CREATE ou APPROVE attendu)." }, { status: 400 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
