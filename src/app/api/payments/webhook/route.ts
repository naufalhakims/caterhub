import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/server/payment";
import { applyWebhookResult } from "@/server/payment-apply";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const provider = getPaymentProvider();
    const result = await provider.handleWebhook(body);
    await applyWebhookResult(result);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
