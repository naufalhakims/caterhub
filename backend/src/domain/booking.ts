import { db } from "../db";
import { OVERBOOK_MSG, toDateLiteral } from "./capacity";
import { calcTotals } from "./quotation";
import { todayDateOnly } from "../lib/date";

/**
 * Terima penawaran → cek kapasitas dalam transaksi → booking + reservedPax.
 * Lock baris availability (SELECT ... FOR UPDATE) mencegah race overbooking.
 */
export async function acceptQuotationAndBook(quotationId: string, customerId: string) {
  return db.$transaction(async (tx) => {
    const q = await tx.quotation.findUnique({
      where: { id: quotationId },
      include: { event: true, vendor: true },
    });
    if (!q) throw new Error("Penawaran tidak ditemukan.");
    if (q.customerId !== customerId) throw new Error("Akses ditolak.");
    if (!["SENT", "REVISION_REQUESTED"].includes(q.status)) {
      throw new Error("Penawaran sudah diproses atau kedaluwarsa.");
    }
    if (q.expiresAt && q.expiresAt < new Date()) {
      await tx.quotation.update({ where: { id: q.id }, data: { status: "EXPIRED" } });
      await tx.quotationHistory.create({
        data: {
          quotationId: q.id,
          actorId: customerId,
          action: "expired",
          fromStatus: q.status,
          toStatus: "EXPIRED",
          note: "Penawaran melewati masa berlaku.",
        },
      });
      throw new Error("Penawaran sudah kedaluwarsa.");
    }
    const vendorUser = await tx.vendorProfile.findUnique({
      where: { id: q.vendorId },
      select: { userId: true },
    });
    if (vendorUser?.userId === customerId) throw new Error("Vendor tidak dapat memesan catering sendiri.");

    const dayLiteral = toDateLiteral(q.event.eventDate);
    const guests = q.event.guestCount;

    const availId = `av_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    await tx.$executeRaw`
      INSERT INTO "Availability" ("id", "vendorId", "date", "maxPax", "reservedPax")
      SELECT ${availId}, ${q.vendorId}, ${dayLiteral}::date,
        (SELECT "maxPax" FROM "VendorProfile" WHERE "id" = ${q.vendorId}), 0
      ON CONFLICT ("vendorId", "date") DO NOTHING`;
    const rows = await tx.$queryRaw<{ maxPax: number; reservedPax: number }[]>`
      SELECT "maxPax", "reservedPax" FROM "Availability"
      WHERE "vendorId" = ${q.vendorId} AND "date" = ${dayLiteral}::date FOR UPDATE`;
    const avail = rows[0];
    if (!avail || avail.reservedPax + guests > avail.maxPax) throw new Error(OVERBOOK_MSG);

    await tx.$executeRaw`
      UPDATE "Availability" SET "reservedPax" = "reservedPax" + ${guests}
      WHERE "vendorId" = ${q.vendorId} AND "date" = ${dayLiteral}::date`;

    const claimed = await tx.quotation.updateMany({
      where: { id: q.id, status: { in: ["SENT", "REVISION_REQUESTED"] } },
      data: { status: "ACCEPTED" },
    });
    if (claimed.count === 0) throw new Error("Penawaran sudah diproses.");

    // Pembayaran hanya satu tahap: lunas.
    const booking = await tx.booking.create({
      data: {
        eventId: q.eventId,
        quotationId: q.id,
        vendorId: q.vendorId,
        customerId,
        status: "PAYMENT_PENDING",
        totalAmount: q.total,
        depositAmount: q.total,
        remainingAmount: 0,
        confirmedAt: new Date(),
      },
    });
    await tx.quotationHistory.create({
      data: {
        quotationId: q.id,
        actorId: customerId,
        action: "accepted",
        fromStatus: q.status,
        toStatus: "ACCEPTED",
        note: "Pelanggan menerima penawaran; pesanan dibuat.",
      },
    });
    await tx.notification.create({
      data: {
        userId: vendorUser!.userId,
        type: "BOOKING",
        title: "Pesanan baru diterima",
        message: `Acara "${q.event.name}" (${guests} pax) telah dikonfirmasi.`,
      },
    });
    return booking;
  });
}

/**
 * Vendor mengonfirmasi permintaan pesanan pelanggan.
 * Biaya tambahan dihitung vendor, lalu total nota dikunci dan pesanan dibuat.
 */
export async function confirmQuotationAndBook(
  quotationId: string,
  vendorId: string,
  fees: { deliveryFee: number; serviceFee: number; discount: number },
) {
  return db.$transaction(async (tx) => {
    const q = await tx.quotation.findUnique({
      where: { id: quotationId },
      include: { event: true, items: true, vendor: { select: { userId: true } } },
    });
    if (!q) throw new Error("Permintaan pesanan tidak ditemukan.");
    if (q.vendorId !== vendorId) throw new Error("Akses ditolak.");
    if (q.origin !== "CUSTOMER_REQUEST") throw new Error("Bukan permintaan pesanan pelanggan.");
    if (q.status !== "REQUESTED") throw new Error("Permintaan ini sudah diproses.");
    if (q.event.eventDate < todayDateOnly()) throw new Error("Tanggal acara sudah lewat.");

    const { subtotal, total } = calcTotals(
      q.items,
      fees.deliveryFee,
      fees.serviceFee,
      fees.discount,
    );
    if (total <= 0) throw new Error("Total nota harus lebih dari 0.");
    const dayLiteral = toDateLiteral(q.event.eventDate);
    const guests = q.event.guestCount;

    const availId = `av_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    await tx.$executeRaw`
      INSERT INTO "Availability" ("id", "vendorId", "date", "maxPax", "reservedPax")
      SELECT ${availId}, ${q.vendorId}, ${dayLiteral}::date,
        (SELECT "maxPax" FROM "VendorProfile" WHERE "id" = ${q.vendorId}), 0
      ON CONFLICT ("vendorId", "date") DO NOTHING`;
    const rows = await tx.$queryRaw<{ maxPax: number; reservedPax: number }[]>`
      SELECT "maxPax", "reservedPax" FROM "Availability"
      WHERE "vendorId" = ${q.vendorId} AND "date" = ${dayLiteral}::date FOR UPDATE`;
    const avail = rows[0];
    if (!avail || avail.reservedPax + guests > avail.maxPax) throw new Error(OVERBOOK_MSG);

    await tx.$executeRaw`
      UPDATE "Availability" SET "reservedPax" = "reservedPax" + ${guests}
      WHERE "vendorId" = ${q.vendorId} AND "date" = ${dayLiteral}::date`;

    const claimed = await tx.quotation.updateMany({
      where: { id: q.id, status: "REQUESTED" },
      data: {
        status: "ACCEPTED",
        subtotal,
        deliveryFee: fees.deliveryFee,
        serviceFee: fees.serviceFee,
        discount: fees.discount,
        total,
      },
    });
    if (claimed.count === 0) throw new Error("Permintaan ini sudah diproses.");

    const booking = await tx.booking.create({
      data: {
        eventId: q.eventId,
        quotationId: q.id,
        vendorId: q.vendorId,
        customerId: q.customerId,
        status: "PAYMENT_PENDING",
        totalAmount: total,
        depositAmount: total,
        remainingAmount: 0,
        confirmedAt: new Date(),
      },
    });
    await tx.quotationHistory.create({
      data: {
        quotationId: q.id,
        actorId: q.vendor.userId,
        action: "accepted",
        fromStatus: "REQUESTED",
        toStatus: "ACCEPTED",
        note: "Vendor mengonfirmasi pesanan. Pelanggan dapat melakukan pembayaran lunas.",
      },
    });
    await tx.notification.create({
      data: {
        userId: q.customerId,
        type: "BOOKING",
        title: "Pesanan dikonfirmasi vendor",
        message: `Pesanan "${q.event.name}" (${guests} pax) disetujui. Total nota ${total.toLocaleString("id-ID")} dan siap dibayar lunas.`,
      },
    });
    return booking;
  });
}

export async function cancelBookingAndRelease(bookingId: string, actor: { vendorId: string }) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { event: { select: { eventDate: true, guestCount: true } } },
    });
    if (!booking) throw new Error("Pesanan tidak ditemukan.");
    if (booking.vendorId !== actor.vendorId) throw new Error("Akses ditolak.");
    if (booking.status === "CANCELLED") return booking;

    const updated = await tx.booking.updateMany({
      where: { id: bookingId, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (updated.count === 0) return booking;

    const dayLiteral = toDateLiteral(booking.event.eventDate);
    await tx.$executeRaw`
      UPDATE "Availability" SET "reservedPax" = GREATEST("reservedPax" - ${booking.event.guestCount}, 0)
      WHERE "vendorId" = ${booking.vendorId} AND "date" = ${dayLiteral}::date`;
    return booking;
  });
}

export const VALID_BOOKING_TRANSITIONS: Record<string, string[]> = {
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  CONFIRMED: ["PAYMENT_PENDING", "PAID", "CANCELLED"],
  PAID: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  QUOTATION_PENDING: [],
  QUOTATION_SENT: [],
  REVISION_REQUESTED: [],
};

export function canTransitionBooking(from: string, to: string): boolean {
  return VALID_BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Status yang boleh diubah vendor secara manual. `PAID` hanya boleh berasal
 * dari webhook pembayaran, bukan tombol/aksi vendor.
 */
export const VENDOR_MANUAL_BOOKING_TARGETS = [
  "PREPARING",
  "READY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

export function canVendorSetBookingStatus(to: string): boolean {
  return (VENDOR_MANUAL_BOOKING_TARGETS as readonly string[]).includes(to);
}
