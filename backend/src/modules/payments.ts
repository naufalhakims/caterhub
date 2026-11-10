import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler, sendError } from "../http";
import { ApiError } from "../errors";
import { applyWebhookResult } from "../domain/payment-apply";
import { MockPaymentProvider, getPaymentProvider } from "../domain/payment";
import { expireUnpaidBookings } from "../domain/booking";

/** Masa berlaku satu tagihan QRIS (dipotong bila batas pelunasan lebih dulu). */
const PAYMENT_TTL_MINUTES = 30;

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
        const b = (req.body ?? {}) as Record<string, unknown>;
        console.warn(
          `[api] webhook ditolak: ${(error as Error).message} ` +
            `(order_id=${String(b.order_id ?? "-")}, status=${String(b.transaction_status ?? "-")}, ` +
            `status_code=${String(b.status_code ?? "-")}, gross_amount=${String(b.gross_amount ?? "-")}, ` +
            `content-type=${req.headers["content-type"] ?? "-"}, keys=${Object.keys(b).join("|")})`,
        );
        throw new ApiError(400, "WEBHOOK_REJECTED", (error as Error).message || "Webhook ditolak.");
      }
      // Order tidak dikenal tetap 200 agar Midtrans tidak mengulang kirim tanpa henti.
      const applied = await applyWebhookResult(result);
      res.json({ data: { ok: true, ignored: applied === null } });
    }),
  );

  router.use(requireAuth);

  router.post(
    "/",
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const input = createSchema.parse(req.body ?? {});
      const owned = await db.booking.findUnique({
        where: { id: input.bookingId },
        select: { customerId: true, status: true, paymentDueAt: true },
      });
      if (!owned || owned.customerId !== user.id) throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      if (owned.status === "PAYMENT_PENDING" && owned.paymentDueAt && owned.paymentDueAt < new Date()) {
        // Lepas kapasitas sekarang juga, jangan menunggu penjadwal.
        await expireUnpaidBookings();
        throw new ApiError(
          409,
          "PAYMENT_OVERDUE",
          "Batas waktu pembayaran sudah lewat; pesanan dibatalkan dan jadwal vendor dilepas.",
        );
      }

      const { payment, reused } = await db.$transaction(
        async (tx) => {
          // Kunci baris booking: dua klik "Bayar" bersamaan tidak boleh membuat dua tagihan.
          await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${input.bookingId} FOR UPDATE`;
          const booking = await tx.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
          if (booking.status === "CANCELLED" || booking.status === "REFUND_PENDING" || booking.status === "REFUNDED") {
            throw new ApiError(409, "BOOKING_CANCELLED", "Pesanan dibatalkan.");
          }
          if (!["PAYMENT_PENDING", "CONFIRMED"].includes(booking.status)) {
            throw new ApiError(409, "PAYMENT_NOT_ALLOWED", "Pembayaran tidak tersedia pada status pesanan ini.");
          }

          const now = new Date();
          const pending = await tx.payment.findFirst({
            where: { bookingId: booking.id, status: "PENDING" },
            orderBy: { createdAt: "desc" },
          });
          if (pending && (!pending.expiresAt || pending.expiresAt > now)) {
            return { payment: pending, reused: true };
          }
          // Tagihan lama sudah habis masa berlakunya → tandai, lalu buat yang baru.
          await tx.payment.updateMany({
            where: { bookingId: booking.id, status: "PENDING" },
            data: { status: "EXPIRED" },
          });

          const paid = await tx.payment.aggregate({
            where: { bookingId: booking.id, status: "SETTLEMENT" },
            _sum: { amount: true },
          });
          const amount = booking.totalAmount - (paid._sum.amount ?? 0);
          if (amount <= 0) throw new ApiError(409, "ALREADY_PAID", "Pesanan sudah lunas.");

          const expiresAt = new Date(
            Math.min(
              now.getTime() + PAYMENT_TTL_MINUTES * 60_000,
              booking.paymentDueAt?.getTime() ?? Number.POSITIVE_INFINITY,
            ),
          );
          const provider = getPaymentProvider();
          let result;
          try {
            result = await provider.createPayment({
              bookingId: booking.id,
              amount,
              customerEmail: user.email,
              expiresInMinutes: (expiresAt.getTime() - now.getTime()) / 60_000,
            });
          } catch (error) {
            // Detail teknis sudah dicatat provider; pelanggan cukup tahu untuk mencoba lagi.
            console.error("[api] gagal membuat tagihan:", (error as Error).message);
            throw new ApiError(
              502,
              "PAYMENT_PROVIDER_ERROR",
              "Layanan pembayaran sedang bermasalah. Coba lagi beberapa saat lagi.",
            );
          }
          const created = await tx.payment.create({
            data: {
              bookingId: booking.id,
              provider: provider.name,
              providerReference: result.providerReference,
              amount,
              method: "QRIS",
              status: "PENDING",
              qrPayload: result.qrPayload,
              expiresAt,
            },
          });
          return { payment: created, reused: false };
        },
        // Pemanggilan provider eksternal terjadi di dalam transaksi.
        { maxWait: 10_000, timeout: 30_000 },
      );
      res.status(reused ? 200 : 201).json({ data: payment });
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
      if (payment.status !== "PENDING" || (payment.expiresAt && payment.expiresAt < new Date())) {
        throw new ApiError(409, "PAYMENT_NOT_PENDING", "Tagihan ini sudah tidak berlaku. Buat tagihan baru dari halaman pesanan.");
      }
      const mock = new MockPaymentProvider();
      await applyWebhookResult(await mock.simulateSettlement(payment.providerReference));
      res.json({ data: { ok: true, bookingId: payment.bookingId } });
    }),
  );

  return router;
}
