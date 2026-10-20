import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler } from "../http";

/**
 * Endpoint baca gabungan (view) untuk halaman.
 * Mengembalikan bentuk yang siap dirender sehingga halaman tidak perlu
 * menggabungkan banyak query sendiri.
 */
export function viewsRouter() {
  const router = Router();

  router.get(
    "/dashboard",
    requireAuth,
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      const customerId = req.user!.id;
      const [events, bookings, pendingQuotes, profile, requests, offers] = await Promise.all([
        db.event.findMany({
          where: { customerId },
          orderBy: { eventDate: "asc" },
          include: {
            quotations: { select: { id: true, status: true, total: true, origin: true } },
            bookings: { select: { id: true, status: true } },
          },
        }),
        db.booking.findMany({
          where: { customerId },
          include: {
            vendor: { select: { id: true, businessName: true, city: true, logoUrl: true } },
            event: true,
            review: { select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        db.quotation.count({
          where: { customerId, status: { in: ["SENT", "REVISION_REQUESTED"] } },
        }),
        db.user.findUnique({ where: { id: customerId }, select: { phone: true, address: true } }),
        db.quotation.findMany({
          where: {
            customerId,
            origin: "CUSTOMER_REQUEST",
            status: { in: ["REQUESTED", "DECLINED"] },
          },
          include: { event: true, vendor: { select: { businessName: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        db.quotation.findMany({
          where: { customerId, status: { in: ["SENT", "REVISION_REQUESTED"] } },
          include: { event: true, vendor: { select: { businessName: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

      res.json({ data: { events, bookings, pendingQuotes, profile, requests, offers } });
    }),
  );

  return router;
}
