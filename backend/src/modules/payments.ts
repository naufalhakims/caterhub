import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler, sendError } from "../http";
import { ApiError } from "../errors";
import { applyWebhookResult } from "../domain/payment-apply";
import { MockPaymentProvider, getPaymentProvider } from "../domain/payment";

const createSchema = z.object({
  bookingId: z.string().min(1),
  // Pembayaran hanya boleh lunas, tanpa DP/termin.
  kind: z.literal("full").default("full"),
});

export function paymentsRouter() {
  const router = Router();

  /** Webhook provider (publik, diverifikasi signature). Harus di atas requireAuth. */
  router.post(
    "/webhook",
    asyncHandler(async (req, res) => {
      const provider = getPaymentProvider();
      let result;
      try {
        result = await provider.handleWebhook(req.body);
      } catch (error) {
        // Signature/payload invalid atau provider dimatikan: bukan error server.
        throw new ApiError(400, "WEBHOOK_REJECTED", (error as Error).message || "Webhook ditolak.");
      }
      await applyWebhookResult(result);
      res.json({ data: { ok: true } });
    }),
  );

  router.use(requireAuth);

  router.post(
    "/",
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const input = createSchema.parse(req.body ?? {});
      const booking = await db.booking.findUnique({ where: { id: input.bookingId } });
      if (!booking || booking.customerId !== user.id) throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      if (booking.status === "CANCELLED") {
        throw new ApiError(409, "BOOKING_CANCELLED", "Pesanan dibatalkan.");
      }
      if (!["PAYMENT_PENDING", "CONFIRMED"].includes(booking.status)) {
        throw new ApiError(409, "PAYMENT_NOT_ALLOWED", "Pembayaran tidak tersedia pada status pesanan ini.");
      }

      const paid = await db.payment.aggregate({
        where: { bookingId: booking.id, status: "SETTLEMENT" },
        _sum: { amount: true },
      });
      const paidSoFar = paid._sum.amount ?? 0;
      const amount = booking.totalAmount - paidSoFar;
      if (amount <= 0) throw new ApiError(409, "ALREADY_PAID", "Pesanan sudah lunas.");

      const provider = getPaymentProvider();
      const result = await provider.createPayment({
        bookingId: booking.id,
        amount,
        customerEmail: user.email,
      });
      const payment = await db.payment.create({
        data: {
          bookingId: booking.id,
          provider: provider.name,
          providerReference: result.providerReference,
          amount,
          method: "QRIS",
          status: "PENDING",
          qrPayload: result.qrPayload,
        },
      });
      res.status(201).json({ data: payment });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const payment = await db.payment.findUnique({
        where: { id: req.params.id },
        include: {
          booking: {
            include: {
              event: true,
              vendor: { select: { id: true, businessName: true, city: true, logoUrl: true } },
              customer: { select: { id: true, name: true, email: true } },
              quotation: { include: { items: true } },
            },
          },
        },
      });
      if (!payment) return sendError(res, 404, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan.");
      const user = req.user!;
      if (user.role !== "ADMIN" && user.id !== payment.booking.customerId) {
        throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      }
      res.json({ data: payment });
    }),
  );

  /** DEV ONLY: simulasi settlement untuk mock provider. */
  router.post(
    "/:id/mock-settle",
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      if (env.paymentProvider === "midtrans") {
        throw new ApiError(403, "NOT_AVAILABLE", "Tidak tersedia untuk provider live.");
      }
      const payment = await db.payment.findUnique({
        where: { id: req.params.id },
        include: { booking: true },
      });
      if (!payment || payment.booking.customerId !== req.user!.id) {
        throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      }
      const mock = new MockPaymentProvider();
      await applyWebhookResult(await mock.simulateSettlement(payment.providerReference));
      res.json({ data: { ok: true, bookingId: payment.bookingId } });
    }),
  );

  return router;
}
