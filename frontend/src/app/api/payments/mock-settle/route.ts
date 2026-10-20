import { NextResponse } from "next/server";
import { ApiError, apiPost } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

// DEV ONLY: proxy simulasi settlement untuk mock provider.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk." }, { status: 401 });

  const form = await req.formData();
  const paymentId = String(form.get("paymentId") ?? "");
  if (!paymentId) return NextResponse.json({ error: "Pembayaran tidak ditemukan." }, { status: 400 });

  try {
    const data = await apiPost<{ bookingId: string }>(`/api/v1/payments/${paymentId}/mock-settle`);
    return NextResponse.redirect(new URL(`/bookings/${data.bookingId}`, req.url), 303);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Gagal mensimulasikan pembayaran.";
    return NextResponse.json({ error: message }, { status });
  }
}
