import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { MockPaymentProvider } from "@/server/payment";
import { applyWebhookResult } from "@/server/payment-apply";

// DEV ONLY: simulasi settlement untuk mock provider. Nonaktif saat provider=midtrans.
export async function POST(req: Request) {
  if (process.env.PAYMENT_PROVIDER === "midtrans") {
    return NextResponse.json({ error: "Tidak tersedia untuk provider live." }, { status: 403 });
  }
  const user = await requireUser();
  const form = await req.formData();
  const paymentId = String(form.get("paymentId") ?? "");
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });
  if (!payment || payment.booking.customerId !== user.id) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  const mock = new MockPaymentProvider();
  await applyWebhookResult(await mock.simulateSettlement(payment.providerReference));
  return NextResponse.redirect(new URL(`/bookings/${payment.bookingId}?ok=Pembayaran berhasil.`, req.url), 303);
}
