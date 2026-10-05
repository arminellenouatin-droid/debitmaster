// DebitMaster: Moneroo est désactivé. Les paiements utilisent désormais PawaPay Mobile Money.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Moneroo est désactivé. Les paiements utilisent désormais PawaPay." },
    { status: 410 }
  );
}
