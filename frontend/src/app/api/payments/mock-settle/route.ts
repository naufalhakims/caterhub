import { NextResponse } from "next/server";
import { ApiError, apiPost } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { redirectTo, withQuery } from "@/lib/redirect";

// DEV ONLY: proxy simulasi settlement untuk mock provider.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk." }, { status: 401 });

  const form = await req.formData();
  const paymentId = String(form.get("paymentId") ?? "");
  if (!paymentId) return NextResponse.json({ error: "Pembayaran tidak ditemukan." }, { status: 400 });

  try {
    const data = await apiPost<{ bookingId: string }>(`/api/v1/payments/${encodeURIComponent(paymentId)}/mock-settle`);
    return redirectTo(`/bookings/${encodeURIComponent(data.bookingId)}`);
  } catch (error) {
    // Kembali ke halaman bayar dengan pesan, bukan menampilkan JSON mentah.
    const message = error instanceof ApiError ? error.message : "Gagal mensimulasikan pembayaran.";
    return redirectTo(withQuery(`/payments/${encodeURIComponent(paymentId)}`, { error: message }));
  }
}
