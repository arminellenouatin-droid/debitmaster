import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCoutureAuditEvent } from "@/lib/couture-audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "payroll.approve");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const action = body.action === "PAID" ? "PAID" : "VALIDATED";
    const paymentReference = typeof body.paymentReference === "string" ? body.paymentReference.trim().slice(0, 120) : null;

    const admin = createSupabaseAdminClient();
    const updates: Record<string, unknown> = {
      status: action,
      updated_at: new Date().toISOString(),
    };

    if (action === "VALIDATED") {
      updates.validated_by = context.user.id;
      updates.validated_at = new Date().toISOString();
    } else if (action === "PAID") {
      updates.paid_at = new Date().toISOString();
      if (paymentReference) updates.payment_reference = paymentReference;
    }

    const { data: updatedPayroll, error } = await admin
      .from("couture_weekly_payrolls")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .select()
      .single();

    if (error || !updatedPayroll) {
      return NextResponse.json({ error: "Décompte introuvable ou mise à jour impossible." }, { status: 400 });
    }

    await writeCoutureAuditEvent({
      tenantId: context.tenantId,
      actorUserId: context.user.id,
      action: `couture.payroll.${action.toLowerCase()}`,
      entityType: "couture_weekly_payrolls",
      entityId: id,
      metadata: {
        action,
        netAmountXof: updatedPayroll.net_amount_xof,
      },
    });

    return NextResponse.json({
      success: true,
      payroll: updatedPayroll,
      message: action === "PAID" ? "Paie hebdomadaire marquée comme payée." : "Paie hebdomadaire validée par la Direction/RH.",
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
