import { db } from "../db";
import { canTransitionBooking } from "./booking";
import { notify, notifyAdmins } from "./notify";
import type { WebhookResult } from "./payment";

/** Booking yang sudah dibatalkan: uang yang masuk belakangan harus dikembalikan. */
const CLOSED_BOOKING_STATUSES = ["CANCELLED", "REFUND_PENDING", "REFUNDED"];

/** Terapkan hasil webhook ke payment+booking. Idempoten; tidak pernah downgrade settlement. */
export async function applyWebhookResult(r: WebhookResult) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { providerReference: r.providerReference },
      include: {
        booking: {
          include: {
            event: { select: { name: true } },
            vendor: { select: { businessName: true } },
          },
        },
      },
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
    if (toPayment !== "SETTLEMENT") return payment;

    const booking = payment.booking;
    const link = `/bookings/${booking.id}`;

    // Dibayar setelah dibatalkan (mis. QR lama tetap dipindai) → wajib refund.
    if (CLOSED_BOOKING_STATUSES.includes(booking.status)) {
      const refundAmount =
        (booking.status === "CANCELLED" ? 0 : (booking.refundAmount ?? 0)) + payment.amount;
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "REFUND_PENDING", refundAmount, refundedAt: null },
      });
      await notify(tx, booking.customerId, {
        type: "REFUND",
        title: "Pembayaran akan dikembalikan",
        message: `Pembayaran untuk "${booking.event.name}" masuk setelah pesanan dibatalkan. Dana ${payment.amount.toLocaleString("id-ID")} akan dikembalikan.`,
        link,
      });
      await notifyAdmins(tx, {
        type: "REFUND",
        title: "Refund perlu diproses",
        message: `Pembayaran telat untuk pesanan batal: ${booking.vendor.businessName} · "${booking.event.name}".`,
        link: "/admin/orders?filter=refund",
      });
      return payment;
    }

    const paid = await tx.payment.aggregate({
      where: { bookingId: payment.bookingId, status: "SETTLEMENT" },
      _sum: { amount: true },
    });
    const paidTotal = paid._sum.amount ?? 0;

    if (paidTotal - payment.amount >= booking.totalAmount) {
      // Sudah lunas sebelumnya: catat kelebihan bayar untuk ditindaklanjuti admin.
      await notifyAdmins(tx, {
        type: "REFUND",
        title: "Kelebihan pembayaran",
        message: `Pesanan "${booking.event.name}" menerima pembayaran ganda ${payment.amount.toLocaleString("id-ID")}.`,
        link,
      });
      return payment;
    }

    if (paidTotal >= booking.totalAmount && canTransitionBooking(booking.status, "PAID")) {
      await tx.booking.update({ where: { id: booking.id }, data: { status: "PAID" } });
    }
    return payment;
  });
}
