import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler, sendError } from "../http";
import { ApiError } from "../errors";
import { canTransitionBooking, cancelBookingAndRelease } from "../domain/booking";
import { parseDateOnly } from "../lib/date";
import { setDailyCapacity } from "../domain/capacity";
import { zIdr, zIdrWithDefault } from "../lib/money";
import { todayDateOnly } from "../lib/date";
import {
  MAX_UPLOAD_BYTES,
  deletePrivateDocument,
  deletePublicImage,
  savePrivateDocument,
  savePublicImage,
  validateUpload,
} from "../storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

async function requireVendor(req: Request) {
  const vendor = await db.vendorProfile.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) throw new ApiError(400, "VENDOR_PROFILE_MISSING", "Profil vendor belum dibuat.");
  return vendor;
}

function hasFile(req: Request): boolean {
  return !!req.file && req.file.size > 0;
}

async function resolveImage(
  req: Request,
  folder: string,
  current: string | null,
): Promise<string | null> {
  if (hasFile(req)) {
    try {
      const validated = validateUpload(req.file!.buffer, req.file!.originalname, { imagesOnly: true });
      const url = await savePublicImage(folder, validated);
      await deletePublicImage(current);
      return url;
    } catch (error) {
      throw new ApiError(400, "INVALID_IMAGE", (error as Error).message);
    }
  }
  if (req.body?.removeImage === "on" || req.body?.removeImage === true) {
    await deletePublicImage(current);
    return null;
  }
  return current;
}

function boolField(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  return !(value === "off" || value === "false" || value === false);
}

const menuSchema = z.object({
  name: z.string().min(2, "Nama menu minimal 2 karakter."),
  description: z.string().max(1000).optional(),
  category: z.string().default("Lauk"),
  price: zIdrWithDefault(0),
  isAvailable: z.boolean().default(true),
});

const packageSchema = z
  .object({
    name: z.string().min(2, "Nama paket minimal 2 karakter."),
    description: z.string().max(2000).optional(),
    pricePerPax: zIdr,
    minPax: z.coerce.number().int().min(1).default(50),
    maxPax: z.coerce.number().int().min(1).default(500),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.minPax <= v.maxPax, {
    message: "Min pax tidak boleh lebih besar dari maks pax.",
  });

const CITY_VALUES = ["Surabaya", "Sidoarjo", "Gresik"] as const;

const vendorProfileSchema = z
  .object({
    businessName: z.string().min(2, "Nama usaha minimal 2 karakter."),
    description: z.string().max(2000).optional(),
    phone: z.string().max(30).optional(),
    address: z.string().max(200).optional(),
    city: z.enum(CITY_VALUES),
    minPax: z.coerce.number().int().min(1, "Min pax minimal 1."),
    maxPax: z.coerce.number().int().min(1, "Maks pax minimal 1."),
  })
  .refine((v) => v.minPax <= v.maxPax, { message: "Min pax tidak boleh lebih besar dari maks pax." });

const capacitySchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi."),
  maxPax: z.coerce.number().int().min(0, "Kapasitas tidak boleh negatif."),
});

const DOC_TYPES = ["BUSINESS_LICENSE", "PREMISES_PHOTO", "KITCHEN_PHOTO", "MENU_PACKAGE", "OTHER"] as const;
const MAX_GALLERY = 8;
const MAX_DOCUMENTS_PER_VENDOR = 20;

export function vendorRouter() {
  const router = Router();
  router.use(requireAuth, requireRole("VENDOR"));

  router.get(
    "/dashboard",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const [pendingQuotes, upcoming, revenue, orderAgg, recent, pendingCount, todayAvail] = await Promise.all([
        db.quotation.findMany({
          where: { vendorId: vendor.id, status: { in: ["REQUESTED", "SENT", "REVISION_REQUESTED"] } },
          include: { event: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        db.booking.findMany({
          where: {
            vendorId: vendor.id,
            status: { in: ["PAID", "PREPARING", "READY", "CONFIRMED", "PAYMENT_PENDING"] },
          },
          include: { event: true },
          orderBy: { event: { eventDate: "asc" } },
          take: 5,
        }),
        db.payment.aggregate({
          where: { booking: { vendorId: vendor.id }, status: "SETTLEMENT" },
          _sum: { amount: true },
        }),
        db.booking.aggregate({
          where: { vendorId: vendor.id, status: { not: "CANCELLED" } },
          _sum: { totalAmount: true },
        }),
        db.booking.findMany({
          where: { vendorId: vendor.id },
          include: { event: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        db.quotation.count({
          where: { vendorId: vendor.id, status: { in: ["REQUESTED", "SENT", "REVISION_REQUESTED"] } },
        }),
        db.availability.findUnique({
          where: { vendorId_date: { vendorId: vendor.id, date: todayDateOnly() } },
        }),
      ]);
      res.json({
        data: {
          vendor,
          pendingQuotes,
          upcoming,
          recent,
          pendingCount,
          revenue: revenue._sum.amount ?? 0,
          orderTotal: orderAgg._sum.totalAmount ?? 0,
          todayAvail,
        },
      });
    }),
  );

  router.get(
    "/analytics",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

      const payments = await db.payment.findMany({
        where: { booking: { vendorId: vendor.id }, status: "SETTLEMENT" },
        include: { booking: { include: { quotation: { include: { package: true } } } } },
        orderBy: { paidAt: "asc" },
      });

      const byMonth = new Map<string, number>();
      for (const p of payments) {
        const d = p.paidAt ?? p.createdAt;
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth.set(k, (byMonth.get(k) ?? 0) + p.amount);
      }
      const chart = [...byMonth.entries()].slice(-6).map(([key, revenue]) => {
        const [y, m] = key.split("-");
        return { month: `${MONTH_ID[Number(m) - 1]} ${y.slice(2)}`, revenue };
      });

      const byPackage = new Map<string, number>();
      for (const p of payments) {
        const name = p.booking.quotation.package?.name ?? "Kustom";
        byPackage.set(name, (byPackage.get(name) ?? 0) + p.amount);
      }
      const total = [...byPackage.values()].reduce((a, b) => a + b, 0);
      const popular = [...byPackage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

      const avail = await db.availability.findMany({
        where: { vendorId: vendor.id, date: { gte: todayDateOnly() } },
        orderBy: { date: "asc" },
        take: 14,
      });

      res.json({ data: { chart, popular, total, avail, paymentCount: payments.length } });
    }),
  );

  // ---------- Penawaran vendor ----------
  router.get(
    "/quotations",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const quotes = await db.quotation.findMany({
        where: { vendorId: vendor.id },
        include: { event: true },
        orderBy: { createdAt: "desc" },
      });
      res.json({ data: quotes });
    }),
  );

  router.get(
    "/me",
    asyncHandler(async (req, res) => {
      const vendor = await db.vendorProfile.findUnique({ where: { userId: req.user!.id } });
      res.json({ data: { user: req.user, vendor } });
    }),
  );

  router.patch(
    "/me",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const input = vendorProfileSchema.parse({
        businessName: req.body?.businessName ?? vendor.businessName,
        description: req.body?.description ?? "",
        phone: req.body?.phone ?? "",
        address: req.body?.address ?? "",
        city: req.body?.city ?? vendor.city,
        minPax: req.body?.minPax ?? vendor.minPax,
        maxPax: req.body?.maxPax ?? vendor.maxPax,
      });
      const updated = await db.vendorProfile.update({
        where: { id: vendor.id },
        data: {
          ...input,
          description: input.description ?? "",
          phone: input.phone ?? "",
          address: input.address ?? "",
        },
      });
      res.json({ data: updated });
    }),
  );

  // ---------- Menu ----------
  router.get(
    "/menu",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const items = await db.menuItem.findMany({ where: { vendorId: vendor.id }, orderBy: { createdAt: "asc" } });
      res.json({ data: items });
    }),
  );

  router.post(
    "/menu",
    upload.single("image"),
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const input = menuSchema.parse({
        name: req.body?.name,
        description: req.body?.description || undefined,
        category: req.body?.category || "Lauk",
        price: req.body?.price ?? 0,
        isAvailable: boolField(req.body?.isAvailable),
      });
      const id = String(req.body?.id ?? "");
      const existing = id ? await db.menuItem.findUnique({ where: { id } }) : null;
      if (id && (!existing || existing.vendorId !== vendor.id)) {
        throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      }
      const imageUrl = await resolveImage(req, `menu/${vendor.id}`, existing?.imageUrl ?? null);
      const saved = existing
        ? await db.menuItem.update({ where: { id: existing.id }, data: { ...input, imageUrl } })
        : await db.menuItem.create({ data: { vendorId: vendor.id, ...input, imageUrl } });
      res.json({ data: saved });
    }),
  );

  router.delete(
    "/menu/:id",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const item = await db.menuItem.findUnique({ where: { id: req.params.id } });
      if (!item || item.vendorId !== vendor.id) throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      await db.menuItem.delete({ where: { id: item.id } });
      await deletePublicImage(item.imageUrl);
      res.status(204).end();
    }),
  );

  // ---------- Paket ----------
  router.get(
    "/packages",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const packages = await db.package.findMany({
        where: { vendorId: vendor.id },
        include: { items: { include: { menuItem: true } } },
        orderBy: { createdAt: "asc" },
      });
      res.json({ data: packages });
    }),
  );

  router.post(
    "/packages",
    upload.single("image"),
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const input = packageSchema.parse({
        name: req.body?.name,
        description: req.body?.description || undefined,
        pricePerPax: req.body?.pricePerPax ?? 0,
        minPax: req.body?.minPax ?? 50,
        maxPax: req.body?.maxPax ?? 500,
        isActive: boolField(req.body?.isActive),
      });
      const id = String(req.body?.id ?? "");
      const menuIds: string[] = Array.isArray(req.body?.menuIds)
        ? req.body.menuIds.map(String)
        : req.body?.menuIds
          ? [String(req.body.menuIds)]
          : [];
      const ownCount = await db.menuItem.count({ where: { id: { in: menuIds }, vendorId: vendor.id } });
      if (menuIds.length > 0 && ownCount !== menuIds.length) {
        throw new ApiError(400, "INVALID_MENU", "Menu tidak valid.");
      }

      const existing = id ? await db.package.findUnique({ where: { id } }) : null;
      if (id && (!existing || existing.vendorId !== vendor.id)) {
        throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      }
      const imageUrl = await resolveImage(req, `packages/${vendor.id}`, existing?.imageUrl ?? null);

      const saved = existing
        ? await db.package.update({
            where: { id: existing.id },
            data: {
              ...input,
              imageUrl,
              items: { deleteMany: {}, create: menuIds.map((menuItemId) => ({ menuItemId })) },
            },
          })
        : await db.package.create({
            data: {
              vendorId: vendor.id,
              ...input,
              imageUrl,
              items: { create: menuIds.map((menuItemId) => ({ menuItemId })) },
            },
          });
      res.json({ data: saved });
    }),
  );

  // ---------- Kapasitas ----------
  router.get(
    "/capacity",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const rows = await db.availability.findMany({
        where: { vendorId: vendor.id },
        orderBy: { date: "asc" },
      });
      res.json({ data: rows });
    }),
  );

  router.post(
    "/capacity",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const input = capacitySchema.parse({ date: req.body?.date, maxPax: req.body?.maxPax ?? 0 });
      try {
        parseDateOnly(input.date);
      } catch {
        throw new ApiError(400, "INVALID_DATE", "Tanggal tidak valid.");
      }
      try {
        const row = await setDailyCapacity(vendor.id, input.date, input.maxPax);
        res.json({ data: row });
      } catch (error) {
        throw new ApiError(409, "CAPACITY_CONFLICT", (error as Error).message);
      }
    }),
  );

  // ---------- Pesanan ----------
  router.get(
    "/bookings",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const rows = await db.booking.findMany({
        where: { vendorId: vendor.id },
        include: {
          event: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          quotation: { select: { id: true, origin: true, status: true } },
          payments: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json({ data: rows });
    }),
  );

  router.post(
    "/bookings/:id/advance",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const to = String(req.body?.to ?? "");
      const booking = await db.booking.findUnique({ where: { id: req.params.id } });
      if (!booking || booking.vendorId !== vendor.id) throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");

      if (to === "CANCELLED") {
        try {
          await cancelBookingAndRelease(booking.id, { vendorId: vendor.id });
        } catch (error) {
          throw new ApiError(409, "CANCEL_FAILED", (error as Error).message);
        }
        return res.json({ data: { ok: true } });
      }
      if (!canTransitionBooking(booking.status, to)) {
        throw new ApiError(409, "INVALID_TRANSITION", "Transisi status tidak valid.");
      }
      const updated = await db.booking.update({ where: { id: booking.id }, data: { status: to as never } });
      res.json({ data: updated });
    }),
  );

  // ---------- Gambar publik ----------
  router.post(
    "/images",
    upload.single("image"),
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const kind = String(req.body?.kind ?? "");
      if (!["logo", "cover", "gallery"].includes(kind)) {
        throw new ApiError(400, "INVALID_KIND", "Jenis gambar tidak valid.");
      }
      if (!hasFile(req)) throw new ApiError(400, "FILE_REQUIRED", "Gambar wajib dipilih.");

      let validated;
      try {
        validated = validateUpload(req.file!.buffer, req.file!.originalname, { imagesOnly: true });
      } catch (error) {
        throw new ApiError(400, "INVALID_IMAGE", (error as Error).message);
      }
      const url = await savePublicImage(`vendors/${vendor.id}`, validated);

      if (kind === "logo") {
        await db.vendorProfile.update({ where: { id: vendor.id }, data: { logoUrl: url } });
        await deletePublicImage(vendor.logoUrl);
      } else if (kind === "cover") {
        await db.vendorProfile.update({ where: { id: vendor.id }, data: { coverUrl: url } });
        await deletePublicImage(vendor.coverUrl);
      } else {
        if (vendor.gallery.length >= MAX_GALLERY) {
          await deletePublicImage(url);
          throw new ApiError(409, "GALLERY_FULL", `Maksimal ${MAX_GALLERY} foto galeri.`);
        }
        await db.vendorProfile.update({
          where: { id: vendor.id },
          data: { gallery: { push: url } },
        });
      }
      res.status(201).json({ data: { url } });
    }),
  );

  router.delete(
    "/images",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const kind = String(req.body?.kind ?? "gallery");
      const url = String(req.body?.url ?? "");

      if (kind === "logo" && vendor.logoUrl === url) {
        await db.vendorProfile.update({ where: { id: vendor.id }, data: { logoUrl: null } });
      } else if (kind === "cover" && vendor.coverUrl === url) {
        await db.vendorProfile.update({ where: { id: vendor.id }, data: { coverUrl: null } });
      } else if (kind === "gallery" && vendor.gallery.includes(url)) {
        await db.vendorProfile.update({
          where: { id: vendor.id },
          data: { gallery: vendor.gallery.filter((g) => g !== url) },
        });
      } else {
        throw new ApiError(404, "IMAGE_NOT_FOUND", "Gambar tidak ditemukan.");
      }
      await deletePublicImage(url);
      res.json({ data: { ok: true } });
    }),
  );

  // ---------- Dokumen verifikasi (privat) ----------
  router.get(
    "/documents",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const docs = await db.vendorDocument.findMany({
        where: { vendorId: vendor.id },
        orderBy: { createdAt: "desc" },
      });
      res.json({ data: docs });
    }),
  );

  router.post(
    "/documents",
    upload.single("file"),
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const type = z.enum(DOC_TYPES).parse(req.body?.type);
      const title = z.string().trim().max(120).optional().parse(req.body?.title || undefined);

      const count = await db.vendorDocument.count({ where: { vendorId: vendor.id } });
      if (count >= MAX_DOCUMENTS_PER_VENDOR) {
        throw new ApiError(
          409,
          "DOCUMENT_LIMIT",
          `Maksimal ${MAX_DOCUMENTS_PER_VENDOR} dokumen. Hapus dokumen lama terlebih dahulu.`,
        );
      }
      if (!hasFile(req)) throw new ApiError(400, "FILE_REQUIRED", "File wajib dipilih.");

      const imagesOnly = type === "PREMISES_PHOTO" || type === "KITCHEN_PHOTO";
      let validated;
      try {
        validated = validateUpload(req.file!.buffer, req.file!.originalname, { imagesOnly });
      } catch (error) {
        throw new ApiError(400, "INVALID_FILE", (error as Error).message);
      }

      const storageKey = await savePrivateDocument(vendor.id, validated);
      const doc = await db.vendorDocument.create({
        data: {
          vendorId: vendor.id,
          type,
          title,
          fileName: validated.originalName,
          storageKey,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          uploadedById: req.user!.id,
        },
      });

      if (vendor.verificationStatus !== "VERIFIED" && vendor.verificationStatus !== "UNDER_REVIEW") {
        await db.vendorProfile.update({
          where: { id: vendor.id },
          data: { verificationStatus: "UNDER_REVIEW" },
        });
      }
      res.status(201).json({ data: doc });
    }),
  );

  router.delete(
    "/documents/:id",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const doc = await db.vendorDocument.findUnique({ where: { id: req.params.id } });
      if (!doc || doc.vendorId !== vendor.id) throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      if (vendor.verificationStatus === "VERIFIED") {
        throw new ApiError(
          409,
          "VERIFIED_LOCKED",
          "Dokumen tidak dapat diubah setelah vendor terverifikasi.",
        );
      }
      await db.vendorDocument.delete({ where: { id: doc.id } });
      await deletePrivateDocument(doc.storageKey);
      res.status(204).end();
    }),
  );

  return router;
}

/** Route dokumen privat (di-mount terpisah, tetap butuh login). */
export function documentsRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const doc = await db.vendorDocument.findUnique({
        where: { id: req.params.id },
        select: {
          fileName: true,
          storageKey: true,
          mimeType: true,
          vendor: { select: { userId: true } },
        },
      });
      if (!doc) return sendError(res, 404, "DOCUMENT_NOT_FOUND", "Dokumen tidak ditemukan.");
      const allowed =
        req.user!.role === "ADMIN" || (req.user!.role === "VENDOR" && doc.vendor.userId === req.user!.id);
      if (!allowed) return sendError(res, 403, "FORBIDDEN", "Akses ditolak.");

      try {
        const buffer = await import("../storage").then((m) => m.readPrivateDocument(doc.storageKey));
        res.setHeader("Content-Type", doc.mimeType);
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.fileName)}"`);
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.send(buffer);
      } catch {
        return sendError(res, 404, "FILE_MISSING", "File tidak tersedia.");
      }
    }),
  );
  return router;
}
