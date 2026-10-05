// DebitMaster: Reversement affilié délégué vers PawaPay.
import { NextResponse } from "next/server";
import { POST as pawapayPayoutPOST } from "@/app/api/admin/payouts/[id]/pawapay/route";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return pawapayPayoutPOST(request, context);
}
