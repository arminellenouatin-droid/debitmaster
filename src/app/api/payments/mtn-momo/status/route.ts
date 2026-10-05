// DebitManager: Statut MTN MoMo délégué vers PawaPay POS status.
import { NextResponse } from "next/server";
import { GET as pawapayStatusGET } from "@/app/api/payments/pawapay/status/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return pawapayStatusGET(request);
}
