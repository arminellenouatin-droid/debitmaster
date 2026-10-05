// DebitManager: MTN MoMo direct est remplacé par PawaPay Mobile Money.
// Les requêtes sont déléguées vers le gestionnaire PawaPay.
import { NextResponse } from "next/server";
import { POST as pawapayPOST } from "@/app/api/payments/pawapay/route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return pawapayPOST(request);
}
