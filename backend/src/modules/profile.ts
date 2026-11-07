import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler } from "../http";

const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(0).max(100).default(30),
  unread: z.enum(["1", "true"]).optional(),
});

const markReadSchema = z.object({
  /** Kosong = tandai semua sebagai dibaca. */
  ids: z.array(z.string().min(1)).max(100).optional(),
});

const PHONE_RE = /^[+]?[\d\s()-]{6,20}$/;

const profileSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80, "Nama maksimal 80 karakter."),
  phone: z
    .string()
    .trim()
    .max(20, "Nomor telepon maksimal 20 karakter.")
    .refine((v) => v === "" || PHONE_RE.test(v), "Nomor telepon tidak valid."),
  address: z.string().trim().max(200, "Alamat maksimal 200 karakter."),
  city: z.string().trim().max(60, "Kota maksimal 60 karakter."),
});

export function profileRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const user = await db.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          role: true,
          createdAt: true,
          _count: { select: { events: true, bookingsAsCustomer: true, reviews: true } },
        },
      });
      res.json({ data: user });
    }),
  );

  /** Notifikasi milik pengguna yang sedang masuk; `limit=0` hanya menghitung belum dibaca. */
  router.get(
    "/notifications",
    asyncHandler(async (req, res) => {
      const q = notificationsQuerySchema.parse(req.query);
      const userId = req.user!.id;
      const [items, unread] = await Promise.all([
        q.limit === 0
          ? Promise.resolve([])
          : db.notification.findMany({
              where: { userId, ...(q.unread ? { readAt: null } : {}) },
              orderBy: { createdAt: "desc" },
              take: q.limit,
            }),
        db.notification.count({ where: { userId, readAt: null } }),
      ]);
      res.json({ data: { items, unread } });
    }),
  );

  router.post(
    "/notifications/read",
    asyncHandler(async (req, res) => {
      const input = markReadSchema.parse(req.body ?? {});
      const result = await db.notification.updateMany({
        where: {
          userId: req.user!.id,
          readAt: null,
          ...(input.ids?.length ? { id: { in: input.ids } } : {}),
        },
        data: { readAt: new Date() },
      });
      res.json({ data: { updated: result.count } });
    }),
  );

  router.patch(
    "/",
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      const input = profileSchema.parse({
        name: req.body?.name ?? "",
        phone: req.body?.phone ?? "",
        address: req.body?.address ?? "",
        city: req.body?.city ?? "",
      });
      const user = await db.user.update({
        where: { id: req.user!.id },
        data: {
          name: input.name,
          phone: input.phone || null,
          address: input.address || null,
          city: input.city || null,
        },
        select: { id: true, name: true, email: true, phone: true, address: true, city: true, role: true },
      });
      res.json({ data: user });
    }),
  );

  return router;
}
