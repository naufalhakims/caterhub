import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler, sendError } from "../http";
import { ApiError } from "../errors";
import { canReviewBooking, roundRating } from "../domain/review";

const decisionSchema = z
  .object({
    decision: z.enum(["review", "approve", "verify", "request_info", "reject"]),
    note: z.string().trim().max(1000, "Catatan maksimal 1000 karakter.").optional(),
  })
  .refine((v) => !["request_info", "reject"].includes(v.decision) || !!v.note, {
    message: "Catatan wajib diisi saat menolak atau meminta perbaikan.",
    path: ["note"],
  });

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Rating minimal 1 bintang.").max(5, "Rating maksimal 5 bintang."),
  comment: z.string().trim().max(1000, "Ulasan maksimal 1000 karakter.").optional(),
});

const STATUS_BY_DECISION = {
  review: "UNDER_REVIEW",
  approve: "VERIFIED",
  verify: "VERIFIED",
  request_info: "NEEDS_INFO",
  reject: "REJECTED",
} as const;

export function adminRouter() {
  const router = Router();
  router.use(requireAuth, requireRole("ADMIN"));

  router.get(
    "/vendors",
    asyncHandler(async (_req, res) => {
      const vendors = await db.vendorProfile.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { documents: true, menuItems: true, packages: true, bookings: true } },
        },
        orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
      });
      res.json({ data: vendors });
    }),
  );

  router.get(
    "/vendors/:id",
    asyncHandler(async (req, res) => {
      const vendor = await db.vendorProfile.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          documents: { orderBy: { createdAt: "desc" } },
          packages: { include: { items: { include: { menuItem: true } } } },
          menuItems: { orderBy: { category: "asc" } },
          _count: { select: { packages: true, bookings: true, menuItems: true } },
          bookings: {
            include: { event: true, customer: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });
      if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor tidak ditemukan.");
      res.json({ data: vendor });
    }),
  );

  router.patch(
    "/vendors/:id/verification",
    asyncHandler(async (req, res) => {
      const input = decisionSchema.parse(req.body ?? {});
      const vendor = await db.vendorProfile.findUnique({ where: { id: req.params.id } });
      if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor tidak ditemukan.");

      const status = STATUS_BY_DECISION[input.decision];
      const updated = await db.vendorProfile.update({
        where: { id: vendor.id },
        data: {
          verificationStatus: status,
          verificationNote: input.note ?? null,
          reviewedAt: new Date(),
          reviewedById: req.user!.id,
        },
      });

      const messageByStatus: Record<string, string> = {
        UNDER_REVIEW: "Dokumen Anda sedang ditinjau admin.",
        VERIFIED: "Selamat! Verifikasi vendor Anda disetujui.",
        NEEDS_INFO: `Admin meminta perbaikan dokumen${input.note ? `: ${input.note}` : "."}`,
        REJECTED: `Verifikasi vendor ditolak${input.note ? `: ${input.note}` : "."}`,
      };
      await db.notification.create({
        data: {
          userId: vendor.userId,
          type: "VERIFICATION",
          title: "Status verifikasi diperbarui",
          message: messageByStatus[status] ?? "Status verifikasi diperbarui.",
        },
      });
      res.json({ data: updated });
    }),
  );

  router.get(
    "/users",
    asyncHandler(async (_req, res) => {
      const users = await db.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          city: true,
          createdAt: true,
          _count: { select: { events: true, bookingsAsCustomer: true } },
          vendorProfile: { select: { id: true, businessName: true, verificationStatus: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json({ data: users });
    }),
  );

  router.get(
    "/orders",
    asyncHandler(async (_req, res) => {
      const bookings = await db.booking.findMany({
        include: {
          event: true,
          customer: { select: { id: true, name: true, email: true } },
          vendor: { select: { id: true, businessName: true, city: true } },
          quotation: { select: { id: true, origin: true, status: true } },
          payments: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json({ data: bookings });
    }),
  );

  router.get(
    "/dashboard",
    asyncHandler(async (_req, res) => {
      const [users, vendors, verified, pending, bookings, revenue, recentVendors] = await Promise.all([
        db.user.count(),
        db.vendorProfile.count(),
        db.vendorProfile.count({ where: { verificationStatus: "VERIFIED" } }),
        db.vendorProfile.count({ where: { verificationStatus: { in: ["PENDING", "UNDER_REVIEW", "NEEDS_INFO"] } } }),
        db.booking.count(),
        db.payment.aggregate({ where: { status: "SETTLEMENT" }, _sum: { amount: true } }),
        db.vendorProfile.findMany({
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);
      res.json({
        data: { users, vendors, verified, pending, bookings, revenue: revenue._sum.amount ?? 0, recentVendors },
      });
    }),
  );

  return router;
}

/** Booking detail (customer/vendor/admin sesuai kepemilikan). */
export function bookingsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.post(
    "/:id/review",
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      const input = reviewSchema.parse(req.body ?? {});
      const user = req.user!;

      const booking = await db.booking.findUnique({
        where: { id: req.params.id },
        include: {
          event: { select: { name: true } },
          vendor: { select: { userId: true, rating: true, reviewCount: true } },
          review: { select: { id: true } },
        },
      });
      if (!booking) return sendError(res, 404, "BOOKING_NOT_FOUND", "Pesanan tidak ditemukan.");
      if (booking.customerId !== user.id) {
        return sendError(res, 403, "FORBIDDEN", "Anda tidak memiliki akses ke pesanan ini.");
      }
      if (!canReviewBooking({
        actorId: user.id,
        customerId: booking.customerId,
        bookingStatus: booking.status,
        hasReview: !!booking.review,
      })) {
        return booking.review
          ? sendError(res, 409, "ALREADY_REVIEWED", "Pesanan ini sudah pernah diulas.")
          : sendError(
              res,
              409,
              "BOOKING_NOT_COMPLETED",
              "Ulasan hanya bisa dibuat setelah pesanan selesai.",
            );
      }

      const comment = input.comment?.trim() || null;
      try {
        const review = await db.$transaction(async (tx) => {
          const created = await tx.review.create({
            data: {
              bookingId: booking.id,
              customerId: user.id,
              vendorId: booking.vendorId,
              rating: input.rating,
              comment,
            },
          });

          // Update inkremental agar rating historis (mis. data seed) tetap terjaga.
          const reviewCount = booking.vendor.reviewCount + 1;
          const rating = roundRating(
            (booking.vendor.rating * booking.vendor.reviewCount + input.rating) / reviewCount,
          );
          await tx.vendorProfile.update({
            where: { id: booking.vendorId },
            data: { rating, reviewCount },
          });
          await tx.notification.create({
            data: {
              userId: booking.vendor.userId,
              type: "REVIEW",
              title: "Ulasan baru diterima",
              message: `${user.name ?? "Pelanggan"} memberi ${input.rating} bintang untuk "${booking.event.name}".`,
            },
          });
          return created;
        });

        res.status(201).json({ data: review });
      } catch (error) {
        // Unique bookingId: dua permintaan bersamaan tetap hanya menghasilkan satu ulasan.
        if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
          return sendError(res, 409, "ALREADY_REVIEWED", "Pesanan ini sudah pernah diulas.");
        }
        throw error;
      }
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const booking = await db.booking.findUnique({
        where: { id: req.params.id },
        include: {
          event: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          vendor: {
            select: {
              id: true,
              userId: true,
              businessName: true,
              city: true,
              phone: true,
              logoUrl: true,
            },
          },
          quotation: { include: { items: true } },
          payments: { orderBy: { createdAt: "desc" } },
          review: true,
        },
      });
      if (!booking) return sendError(res, 404, "BOOKING_NOT_FOUND", "Pesanan tidak ditemukan.");
      const user = req.user!;
      const allowed =
        user.role === "ADMIN" || user.id === booking.customerId || user.id === booking.vendor.userId;
      if (!allowed) throw new ApiError(403, "FORBIDDEN", "Anda tidak memiliki akses ke pesanan ini.");
      res.json({ data: booking });
    }),
  );

  return router;
}
