import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler } from "../http";
import { ApiError } from "../errors";
import { zIdrWithDefault } from "../lib/money";
import { parseDateOnly } from "../lib/date";
import { createOfflineBooking, recordOfflinePayment } from "../domain/booking";

const offlineSchema = z.object({
  customerName: z.string().trim().min(2, "Nama pelanggan minimal 2 karakter.").max(80),
  customerPhone: z.string().trim().max(20).optional(),
  eventName: z.string().trim().min(3, "Nama acara minimal 3 karakter.").max(120),
  eventDate: z.string().min(1, "Tanggal acara wajib diisi."),
  eventTime: z.string().trim().min(1, "Jam acara wajib diisi.").max(20),
  guestCount: z.coerce.number().int().min(1, "Jumlah porsi minimal 1.").max(100_000),
  location: z.string().trim().min(3, "Lokasi wajib diisi.").max(300),
  city: z.string().trim().max(50).default("Surabaya"),
  packageId: z.string().min(1, "Pilih paket."),
  addOnIds: z.array(z.string().min(1)).max(30).default([]),
  deliveryFee: zIdrWithDefault(0),
  serviceFee: zIdrWithDefault(0),
  discount: zIdrWithDefault(0),
  notes: z.string().max(1000).optional(),
  payment: z.enum(["NONE", "CASH", "TRANSFER"]).default("NONE"),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

const manualPaymentSchema = z.object({ method: z.enum(["CASH", "TRANSFER"]) });

/** Pesanan offline (dari WA/telepon) dan pembayaran manualnya. */
export function offlineRouter() {
  const router = Router();
  router.use(requireAuth, requireRole("VENDOR"));

  router.post(
    "/bookings/offline",
    asyncHandler(async (req, res) => {
      const input = offlineSchema.parse(req.body ?? {});
      let eventDate: Date;
      try {
        eventDate = parseDateOnly(input.eventDate);
      } catch {
        throw new ApiError(400, "INVALID_DATE", "Tanggal acara tidak valid.");
      }
      try {
        const booking = await createOfflineBooking({ ...input, eventDate, vendorUserId: req.user!.id });
        res.status(201).json({ data: { bookingId: booking.id, invoiceNumber: booking.invoiceNumber } });
      } catch (error) {
        throw new ApiError(409, "OFFLINE_ORDER_FAILED", (error as Error).message);
      }
    }),
  );

  router.post(
    "/bookings/:id/manual-payment",
    asyncHandler(async (req, res) => {
      const { method } = manualPaymentSchema.parse(req.body ?? {});
      try {
        const result = await recordOfflinePayment(req.params.id, req.user!.id, method);
        res.json({ data: result });
      } catch (error) {
        const message = (error as Error).message;
        throw new ApiError(message === "Akses ditolak." ? 403 : 409, "MANUAL_PAYMENT_FAILED", message);
      }
    }),
  );

  return router;
}
