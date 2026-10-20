import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api";

/**
 * Webhook publik: diteruskan apa adanya ke API. Verifikasi signature dilakukan
 * di backend (Midtrans), bukan di frontend.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const res = await fetch(`${apiBaseUrl()}/api/v1/payments/webhook`, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/json",
        accept: "application/json",
      },
      body: raw,
      cache: "no-store",
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Layanan pembayaran tidak tersedia." }, { status: 502 });
  }
}
