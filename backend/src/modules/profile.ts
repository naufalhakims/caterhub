import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler } from "../http";

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
