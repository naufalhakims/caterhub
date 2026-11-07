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
    // Kembali ke halaman bayar dengan pesan, bukan menampilkan JSON mentah.
    const message = error instanceof ApiError ? error.message : "Gagal mensimulasikan pembayaran.";
    const back = new URL(`/payments/${paymentId}`, req.url);
    back.searchParams.set("error", message);
    return NextResponse.redirect(back, 303);
  }
}
