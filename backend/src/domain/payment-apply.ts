import { db } from "../db";
import { canTransitionBooking } from "./booking";
import type { WebhookResult } from "./payment";

/** Terapkan hasil webhook ke payment+booking. Idempoten; tidak pernah downgrade settlement. */
export async function applyWebhookResult(r: WebhookResult) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { providerReference: r.providerReference },
      include: { booking: true },
    });
    if (!payment) throw new Error("Payment tidak ditemukan.");
    const toPayment =
      r.status === "settlement"
        ? "SETTLEMENT"
        : r.status === "failed"
          ? "FAILED"
          : r.status === "expired"
            ? "EXPIRED"
            : "PENDING";
    if (payment.status === toPayment) return payment;
    if (payment.status === "SETTLEMENT") return payment;

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
        paidTotal >= payment.booking.totalAmount
          ? "PAID"
          : payment.booking.status === "PAYMENT_PENDING"
            ? "PAYMENT_PENDING"
            : payment.booking.status;
      if (next !== payment.booking.status && canTransitionBooking(payment.booking.status, next)) {
        await tx.booking.update({ where: { id: payment.bookingId }, data: { status: next } });
      }
    }
    return payment;
  });
}
