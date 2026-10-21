import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler, sendError } from "../http";
import { calcTotals } from "../domain/quotation";
import {
  canPerformQuotationDecision,
  nextQuotationStatus,
  type QuotationDecision,
} from "../domain/quotation-workflow";
import { acceptQuotationAndBook, confirmQuotationAndBook } from "../domain/booking";
import { canViewQuotation, isOfferParty } from "../domain/access";
import { checkCapacity } from "../domain/capacity";
import { toDateOnly, todayDateOnly } from "../lib/date";
import { zIdrWithDefault } from "../lib/money";

const EDITABLE_STATUSES = ["REQUESTED", "SENT", "REVISION_REQUESTED"] as const;

const sendSchema = z.object({
  quotationId: z.string().optional(),
  eventId: z.string().min(1),
  customerId: z.string().min(1),
  packageId: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        quantity: z.coerce.number().int().min(1),
        unitPrice: zIdrWithDefault(0),
      }),
    )
    .min(1, "Minimal 1 item."),
  deliveryFee: zIdrWithDefault(0),
  serviceFee: zIdrWithDefault(0),
  discount: zIdrWithDefault(0),
  notes: z.string().max(2000).optional(),
  expiresAt: z.coerce.date().optional(),
});

const requestSchema = z
  .object({
    eventId: z.string().min(1).optional(),
    eventDate: z.string().min(1).optional(),
    eventTime: z.string().trim().min(1, "Jam acara wajib diisi.").max(20).optional(),
    guestCount: z.coerce.number().int().min(10, "Minimal 10 pax.").max(100_000).optional(),
    location: z.string().trim().min(3, "Lokasi wajib diisi.").max(300).optional(),
    city: z.string().trim().max(50).default("Surabaya"),
    packageId: z.string().min(1),
    vendorId: z.string().min(1),
    notes: z.string().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.eventId) return;
    for (const [key, message] of [
      ["eventDate", "Tanggal acara wajib diisi."],
      ["eventTime", "Jam acara wajib diisi."],
      ["guestCount", "Jumlah tamu wajib diisi."],
      ["location", "Lokasi acara wajib diisi."],
    ] as const) {
      if (!v[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [key] });
    }
  });

const confirmSchema = z.object({
  deliveryFee: zIdrWithDefault(0),
  serviceFee: zIdrWithDefault(0),
  discount: zIdrWithDefault(0),
});

const decisionSchema = z
  .object({
    decision: z.enum(["accept", "reject", "revision"]),
    revisionNote: z.string().max(1000).optional(),
  })
  .refine((v) => v.decision !== "revision" || !!v.revisionNote?.trim(), {
    message: "Catatan revisi wajib diisi bila meminta revisi.",
    path: ["revisionNote"],
  });

const messageSchema = z.object({
  body: z.string().trim().min(1, "Pesan tidak boleh kosong.").max(2000, "Pesan maksimal 2000 karakter."),
});

export function quotationsRouter() {
  const router = Router();
  router.use(requireAuth);

  /** Pelanggan membuat permintaan pesanan (bukan penawaran vendor). */
  router.post(
    "/request",
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      const input = requestSchema.parse(req.body ?? {});
      const user = req.user!;

      const vendor = await db.vendorProfile.findUnique({ where: { id: input.vendorId } });
      if (!vendor || vendor.verificationStatus !== "VERIFIED") {
        return sendError(res, 400, "VENDOR_NOT_VERIFIED", "Vendor belum terverifikasi.");
      }
      if (vendor.userId === user.id) {
        return sendError(res, 400, "SELF_ORDER", "Vendor tidak dapat memesan catering sendiri.");
      }
      const pkg = await db.package.findUnique({ where: { id: input.packageId } });
      if (!pkg || pkg.vendorId !== vendor.id || !pkg.isActive) {
        return sendError(res, 400, "INVALID_PACKAGE", "Paket tidak valid.");
      }

      let savedEvent: {
        id: string;
        customerId: string;
        name: string;
        guestCount: number;
        eventDate: Date;
        eventTime: string | null;
      } | null = null;
      if (input.eventId) {
        savedEvent = await db.event.findUnique({ where: { id: input.eventId } });
        if (!savedEvent || savedEvent.customerId !== user.id) {
          return sendError(res, 403, "FORBIDDEN", "Akses ditolak.");
        }
      }

      let eventDate: Date;
      let guestCount: number;
      try {
        eventDate = savedEvent ? savedEvent.eventDate : toDateOnly(input.eventDate!);
      } catch {
        return sendError(res, 400, "VALIDATION_ERROR", "Tanggal acara tidak valid.");
      }
      guestCount = savedEvent?.guestCount ?? input.guestCount!;
      if (eventDate < todayDateOnly()) {
        return sendError(res, 400, "DATE_IN_PAST", "Tanggal acara sudah lewat.");
      }
      if (guestCount < pkg.minPax || guestCount > pkg.maxPax) {
        return sendError(
          res,
          400,
          "PAX_OUT_OF_RANGE",
          `Jumlah tamu di luar rentang paket (${pkg.minPax}–${pkg.maxPax} pax).`,
        );
      }

      const existing = await db.quotation.findFirst({
        where: {
          vendorId: input.vendorId,
          customerId: user.id,
          origin: "CUSTOMER_REQUEST",
          status: "REQUESTED",
          event: { eventDate },
        },
      });
      if (existing) return res.status(200).json({ data: { id: existing.id, existing: true } });

      const capacity = await checkCapacity(vendor.id, eventDate, guestCount);
      if (!capacity.ok) {
        return sendError(
          res,
          400,
          "CAPACITY_FULL",
          `Kapasitas vendor tidak mencukupi (sisa ${capacity.remaining} pax pada tanggal tersebut).`,
        );
      }

      const estimate = pkg.pricePerPax * guestCount;
      const quotation = await db.$transaction(async (tx) => {
        const event =
          savedEvent ??
          (await tx.event.create({
            data: {
              customerId: user.id,
              name: `Pesanan ${pkg.name}`,
              eventType: "OTHER",
              eventDate,
              eventTime: input.eventTime!,
              location: input.location!,
              city: input.city || "Surabaya",
              guestCount,
              notes: input.notes,
            },
          }));

        return tx.quotation.create({
          data: {
            eventId: event.id,
            packageId: input.packageId,
            vendorId: input.vendorId,
            customerId: user.id,
            origin: "CUSTOMER_REQUEST",
            status: "REQUESTED",
            subtotal: estimate,
            total: estimate,
            notes: input.notes,
            items: {
              create: [
                {
                  name: `Paket ${pkg.name} (${guestCount} pax)`,
                  quantity: guestCount,
                  unitPrice: pkg.pricePerPax,
                  subtotal: estimate,
                },
              ],
            },
            history: {
              create: {
                actorId: user.id,
                action: "created",
                toStatus: "REQUESTED",
                note: `Permintaan pesanan dari pelanggan untuk "${event.name}".`,
              },
            },
          },
        });
      });
      await db.notification.create({
        data: {
          userId: vendor.userId,
          type: "ORDER_REQUEST",
          title: "Permintaan pesanan baru",
          message: `"${savedEvent?.name ?? `Pesanan ${pkg.name}`}" (${guestCount} pax, ${input.eventTime ?? savedEvent?.eventTime ?? "jam menyusul"}) menunggu konfirmasi Anda.`,
        },
      });
      res.status(201).json({ data: { id: quotation.id, existing: false } });
    }),
  );

  /** Vendor mengirim penawaran baru atau memperbarui penawaran/revisi. */
  router.post(
    "/",
    requireRole("VENDOR"),
    asyncHandler(async (req, res) => {
      const input = sendSchema.parse(req.body ?? {});
      const user = req.user!;
      const vendor = await db.vendorProfile.findUnique({ where: { userId: user.id } });
      if (!vendor) return sendError(res, 400, "VENDOR_PROFILE_MISSING", "Profil vendor belum dibuat.");
      if (vendor.verificationStatus !== "VERIFIED") {
        return sendError(
          res,
          403,
          "VENDOR_NOT_VERIFIED",
          "Penawaran hanya bisa dikirim setelah verifikasi disetujui.",
        );
      }

      const event = await db.event.findUnique({ where: { id: input.eventId } });
      if (!event || event.customerId !== input.customerId) {
        return sendError(res, 403, "FORBIDDEN", "Akses ditolak.");
      }

      const { subtotal, total } = calcTotals(input.items, input.deliveryFee, input.serviceFee, input.discount);
      const itemsData = input.items.map((i) => ({
        name: i.name,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.quantity * i.unitPrice,
      }));

      if (input.quotationId) {
        const existing = await db.quotation.findUnique({ where: { id: input.quotationId } });
        if (!existing || existing.vendorId !== vendor.id) {
          return sendError(res, 403, "FORBIDDEN", "Akses ditolak.");
        }
        if (existing.customerId !== input.customerId) {
          return sendError(res, 403, "FORBIDDEN", "Akses ditolak.");
        }
        if (!EDITABLE_STATUSES.includes(existing.status as (typeof EDITABLE_STATUSES)[number])) {
          return sendError(
            res,
            409,
            "NOT_EDITABLE",
            `Penawaran berstatus ${existing.status} tidak bisa diubah.`,
          );
        }

        const nextStatus =
          existing.status === "REQUESTED" || existing.status === "REVISION_REQUESTED"
            ? "SENT"
            : existing.status;

        await db.quotation.update({
          where: { id: existing.id },
          data: {
            packageId: input.packageId,
            subtotal,
            deliveryFee: input.deliveryFee,
            serviceFee: input.serviceFee,
            discount: input.discount,
            total,
            notes: input.notes,
            expiresAt: input.expiresAt,
            origin: existing.origin,
            status: nextStatus,
            items: { deleteMany: {}, create: itemsData },
          },
        });
        await db.quotationHistory.create({
          data: {
            quotationId: existing.id,
            actorId: user.id,
            action: existing.status === "REQUESTED" ? "sent" : "revised",
            fromStatus: existing.status,
            toStatus: nextStatus,
            note:
              existing.status === "REQUESTED"
                ? "Vendor mengirim penawaran atas permintaan pelanggan."
                : "Vendor memperbarui penawaran.",
          },
        });
        await db.notification.create({
          data: {
            userId: input.customerId,
            type: "QUOTATION",
            title: existing.status === "REQUESTED" ? "Penawaran untuk permintaan Anda" : "Penawaran diperbarui",
            message: `Vendor ${vendor.businessName} memperbarui penawaran untuk "${event.name}".`,
          },
        });
        return res.json({ data: { id: existing.id } });
      }

      const q = await db.quotation.create({
        data: {
          eventId: input.eventId,
          packageId: input.packageId,
          vendorId: vendor.id,
          customerId: input.customerId,
          origin: "VENDOR_OFFER",
          status: "SENT",
          subtotal,
          deliveryFee: input.deliveryFee,
          serviceFee: input.serviceFee,
          discount: input.discount,
          total,
          notes: input.notes,
          expiresAt: input.expiresAt,
          items: { create: itemsData },
          history: {
            create: {
              actorId: user.id,
              action: "sent",
              toStatus: "SENT",
              note: "Vendor mengirim penawaran.",
            },
          },
        },
      });
      await db.notification.create({
        data: {
          userId: input.customerId,
          type: "QUOTATION",
          title: "Penawaran baru diterima",
          message: `Vendor ${vendor.businessName} mengirim penawaran untuk "${event.name}".`,
        },
      });
      res.status(201).json({ data: { id: q.id } });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const q = await db.quotation.findUnique({
        where: { id: req.params.id },
        include: {
          event: true,
          package: true,
          vendor: {
            select: {
              id: true,
              userId: true,
              businessName: true,
              logoUrl: true,
              city: true,
              phone: true,
              verificationStatus: true,
            },
          },
          customer: { select: { id: true, name: true, email: true, phone: true } },
          items: true,
          booking: { select: { id: true, status: true } },
          messages: {
            include: { sender: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "asc" },
          },
          history: {
            include: { actor: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!q) return sendError(res, 404, "QUOTATION_NOT_FOUND", "Penawaran tidak ditemukan.");
      if (!canViewQuotation({ id: user.id, role: user.role }, { customerId: q.customerId, vendorUserId: q.vendor.userId })) {
        return sendError(res, 403, "FORBIDDEN", "Anda tidak memiliki akses ke penawaran ini.");
      }

      res.json({
        data: {
          ...q,
          viewer: {
            id: user.id,
            role: user.role,
            isParty: isOfferParty(
              { id: user.id, role: user.role },
              { customerId: q.customerId, vendorUserId: q.vendor.userId },
            ),
          },
        },
      });
    }),
  );

  /** Vendor mengonfirmasi permintaan dan menetapkan biaya tambahan nota. */
  router.post(
    "/:id/confirm",
    requireRole("VENDOR"),
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const vendor = await db.vendorProfile.findUnique({ where: { userId: user.id } });
      if (!vendor) return sendError(res, 400, "VENDOR_PROFILE_MISSING", "Profil vendor belum dibuat.");
      const input = confirmSchema.parse(req.body ?? {});

      const q = await db.quotation.findUnique({ where: { id: req.params.id } });
      if (!q || q.vendorId !== vendor.id) return sendError(res, 403, "FORBIDDEN", "Akses ditolak.");
      if (
        !canPerformQuotationDecision({
          decision: "confirm_request",
          actorRole: "VENDOR",
          origin: q.origin,
          status: q.status,
        })
      ) {
        return sendError(
          res,
          409,
          "INVALID_TRANSITION",
          `Permintaan ini tidak bisa dikonfirmasi (status ${q.status}).`,
        );
      }

      try {
        const booking = await confirmQuotationAndBook(q.id, vendor.id, input);
        res.json({ data: { bookingId: booking.id } });
      } catch (error) {
        return sendError(res, 409, "CONFIRM_FAILED", (error as Error).message);
      }
    }),
  );

  router.post(
    "/:id/decline",
    requireRole("VENDOR"),
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const vendor = await db.vendorProfile.findUnique({ where: { userId: user.id } });
      if (!vendor) return sendError(res, 400, "VENDOR_PROFILE_MISSING", "Profil vendor belum dibuat.");
      const reason = z.string().max(500).optional().parse(req.body?.reason);

      const q = await db.quotation.findUnique({ where: { id: req.params.id } });
      if (!q || q.vendorId !== vendor.id) return sendError(res, 403, "FORBIDDEN", "Akses ditolak.");
      if (
        !canPerformQuotationDecision({
          decision: "decline_request",
          actorRole: "VENDOR",
          origin: q.origin,
          status: q.status,
        })
      ) {
        return sendError(
          res,
          409,
          "INVALID_TRANSITION",
          `Permintaan ini tidak bisa ditolak (status ${q.status}).`,
        );
      }

      await db.quotation.update({
        where: { id: q.id },
        data: { status: nextQuotationStatus("decline_request") },
      });
      await db.quotationHistory.create({
        data: {
          quotationId: q.id,
          actorId: user.id,
          action: "declined",
          fromStatus: q.status,
          toStatus: "DECLINED",
          note: reason || "Vendor menolak permintaan.",
        },
      });
      await db.notification.create({
        data: {
          userId: q.customerId,
          type: "QUOTATION",
          title: "Permintaan ditolak vendor",
          message: reason ? `Vendor menolak permintaan: ${reason}` : "Vendor tidak dapat memenuhi permintaan ini.",
        },
      });
      res.json({ data: { ok: true } });
    }),
  );

  router.post(
    "/:id/decision",
    requireRole("CUSTOMER"),
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const input = decisionSchema.parse(req.body ?? {});
      const mapped: QuotationDecision =
        input.decision === "accept" ? "accept" : input.decision === "reject" ? "reject" : "request_revision";

      const q = await db.quotation.findUnique({ where: { id: req.params.id } });
      if (!q) return sendError(res, 404, "QUOTATION_NOT_FOUND", "Penawaran tidak ditemukan.");
      if (q.customerId !== user.id) return sendError(res, 403, "FORBIDDEN", "Akses ditolak.");
      if (
        !canPerformQuotationDecision({
          decision: mapped,
          actorRole: "CUSTOMER",
          origin: q.origin,
          status: q.status,
        })
      ) {
        return sendError(
          res,
          409,
          "INVALID_TRANSITION",
          `Penawaran berstatus ${q.status} tidak bisa diputuskan lagi.`,
        );
      }

      if (mapped === "reject") {
        await db.quotation.update({ where: { id: q.id }, data: { status: "REJECTED" } });
        await db.quotationHistory.create({
          data: {
            quotationId: q.id,
            actorId: user.id,
            action: "rejected",
            fromStatus: q.status,
            toStatus: "REJECTED",
            note: "Pelanggan menolak penawaran.",
          },
        });
        return res.json({ data: { ok: true } });
      }

      if (mapped === "request_revision") {
        await db.quotation.update({
          where: { id: q.id },
          data: { status: "REVISION_REQUESTED", revisionNote: input.revisionNote!.trim() },
        });
        await db.quotationHistory.create({
          data: {
            quotationId: q.id,
            actorId: user.id,
            action: "revision_requested",
            fromStatus: q.status,
            toStatus: "REVISION_REQUESTED",
            note: input.revisionNote!.trim(),
          },
        });
        return res.json({ data: { ok: true } });
      }

      try {
        const booking = await acceptQuotationAndBook(q.id, user.id);
        res.json({ data: { bookingId: booking.id } });
      } catch (error) {
        return sendError(res, 409, "BOOKING_FAILED", (error as Error).message);
      }
    }),
  );

  router.post(
    "/:id/messages",
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const input = messageSchema.parse(req.body ?? {});
      const q = await db.quotation.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          customerId: true,
          vendor: { select: { userId: true, businessName: true } },
          event: { select: { name: true } },
        },
      });
      if (!q) return sendError(res, 404, "QUOTATION_NOT_FOUND", "Penawaran tidak ditemukan.");
      // Admin sengaja tidak diikutsertakan dalam chat.
      if (!isOfferParty({ id: user.id, role: user.role }, { customerId: q.customerId, vendorUserId: q.vendor.userId })) {
        return sendError(res, 403, "FORBIDDEN", "Akses ditolak.");
      }

      const message = await db.offerMessage.create({
        data: { quotationId: q.id, senderId: user.id, body: input.body },
      });
      const recipientId = user.id === q.customerId ? q.vendor.userId : q.customerId;
      await db.notification.create({
        data: {
          userId: recipientId,
          type: "MESSAGE",
          title: "Pesan baru pada penawaran",
          message: `${user.name ?? "Pengguna"} mengirim pesan tentang "${q.event.name}".`,
        },
      });
      res.status(201).json({ data: message });
    }),
  );

  return router;
}
