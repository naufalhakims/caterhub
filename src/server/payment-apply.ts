// Modul internal — JANGAN diberi "use server".
// File dengan "use server" mengekspos setiap fungsi yang di-export sebagai endpoint
// yang bisa dipanggil klien. applyWebhookResult hanya boleh dipanggil dari route
// webhook/mock-settle yang sudah diautentikasi/diverifikasi.
import { db } from "@/lib/db";
import { canTransitionBooking } from "@/server/booking";
import type { WebhookResult } from "@/server/payment";

// Terapkan hasil webhook ke payment+booking. Idempoten: status sama → skip.
export async function applyWebhookResult(r: WebhookResult) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { providerReference: r.providerReference },
      include: { booking: true },
    });
    if (!payment) throw new Error("Payment tidak ditemukan.");
    const toPayment =
      r.status === "settlement" ? "SETTLEMENT"
      : r.status === "failed" ? "FAILED"
      : r.status === "expired" ? "EXPIRED" : "PENDING";
    if (payment.status === toPayment) return payment; // idempoten
    if (payment.status === "SETTLEMENT") return payment; // jangan downgrade settlement
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: toPayment, paidAt: toPayment === "SETTLEMENT" ? new Date() : null },
    });
    if (toPayment === "SETTLEMENT") {
      const paid = await tx.payment.aggregate({
        where: { bookingId: payment.bookingId, status: "SETTLEMENT" },
        _sum: { amount: true },
      });
      const paidTotal = paid._sum.amount ?? 0;
      const next =
        paidTotal >= payment.booking.totalAmount ? "PAID"
        : payment.booking.status === "PAYMENT_PENDING" ? "PAYMENT_PENDING" : payment.booking.status;
      if (next !== payment.booking.status && canTransitionBooking(payment.booking.status, next)) {
        await tx.booking.update({ where: { id: payment.bookingId }, data: { status: next } });
      }
    }
    return payment;
  });
}
