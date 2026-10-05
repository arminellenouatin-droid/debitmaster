// DebitMaster PawaPay Checkout (Caisse) Webhook Handler
import { NextResponse } from "next/server";
import { handlePawaPayPayload } from "../route";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "pawapay-checkout-webhook",
    status: "active",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ received: true });
    }
    const payload = JSON.parse(rawBody);
    return await handlePawaPayPayload(payload);
  } catch (error) {
    return NextResponse.json({ received: true, error: "invalid_body" });
  }
}
