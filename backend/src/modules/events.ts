import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler, sendError } from "../http";
import { toDateOnly } from "../lib/date";
import { zIdrOptional } from "../lib/money";

export const eventSchema = z
  .object({
    name: z.string().min(3, "Nama acara minimal 3 karakter."),
    eventType: z.enum(["WEDDING", "BIRTHDAY", "CORPORATE", "MEETING", "SEMINAR", "GATHERING", "GRADUATION", "OTHER"]),
    eventDate: z.union([z.string(), z.date()]).transform((v, ctx) => {
      try {
        return toDateOnly(v);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tanggal tidak valid." });
        return z.NEVER;
      }
    }),
    eventTime: z.string().max(10).optional(),
    location: z.string().min(3, "Lokasi wajib diisi."),
    city: z.string().default("Surabaya"),
    guestCount: z.coerce.number().int().min(10, "Minimal 10 pax.").max(100_000, "Jumlah pax tidak wajar."),
    budgetMin: zIdrOptional,
    budgetMax: zIdrOptional,
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax, {
    message: "Budget minimum tidak boleh lebih besar dari budget maksimum.",
    path: ["budgetMax"],
  });

export function eventsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/",
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      const events = await db.event.findMany({
        where: { customerId: req.user!.id },
        orderBy: { eventDate: "asc" },
        include: {
          quotations: { select: { id: true, status: true, total: true, origin: true } },
          bookings: { select: { id: true, status: true } },
        },
      });
      res.json({ data: events });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const event = await db.event.findUnique({
        where: { id: req.params.id },
        include: {
          quotations: {
            include: { vendor: { select: { id: true, businessName: true, logoUrl: true } } },
            orderBy: { createdAt: "desc" },
          },
          bookings: {
            include: { vendor: { select: { id: true, businessName: true, logoUrl: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!event) return sendError(res, 404, "EVENT_NOT_FOUND", "Acara tidak ditemukan.");
      if (req.user!.role !== "ADMIN" && event.customerId !== req.user!.id) {
        return sendError(res, 403, "FORBIDDEN", "Anda tidak memiliki akses ke acara ini.");
      }
      res.json({ data: event });
    }),
  );

  router.post(
    "/",
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      const input = eventSchema.parse(req.body ?? {});
      const event = await db.event.create({
        data: { customerId: req.user!.id, ...input },
      });
      res.status(201).json({ data: event });
    }),
  );

  return router;
}
