// DebitManager: Moneroo est abandonné. Les nouveaux encaissements utilisent /api/payments/mtn-momo.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Moneroo est désactivé. Utilisez MTN MoMo pour ce paiement." }, { status: 410 });
}
