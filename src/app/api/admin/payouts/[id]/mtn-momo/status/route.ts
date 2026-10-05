// DebitMaster: Statut de reversement affilié délégué vers PawaPay.
import { NextResponse } from "next/server";
import { GET as pawapayPayoutStatusGET } from "@/app/api/admin/payouts/[id]/pawapay/status/route";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return pawapayPayoutStatusGET(request, context);
}
