import { db } from "../db";
import { OVERBOOK_MSG, toDateLiteral } from "./capacity";
import { buildRequestItems, calcTotals } from "./quotation";
import { nextInvoiceNumber } from "./invoice";
import { diffInDays, todayDateOnly } from "../lib/date";
import { notify, notifyAdmins, type Db } from "./notify";

/** Lama waktu pelanggan untuk melunasi setelah vendor mengonfirmasi. */
export const PAYMENT_WINDOW_HOURS = Number(process.env.PAYMENT_WINDOW_HOURS ?? 24);
/** Selisih UTC → WIB; acara dianggap mulai pukul 00:00 WIB pada tanggalnya. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MIN_PAYMENT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Batas pelunasan: `PAYMENT_WINDOW_HOURS` dari sekarang, tetapi tidak melewati
 * awal hari acara (WIB). Minimal satu jam agar pelanggan tetap sempat membayar
 * pesanan yang dikonfirmasi pada hari acara.
 */
export function computePaymentDueAt(
  now: Date,
  eventDate: Date,
  windowHours = PAYMENT_WINDOW_HOURS,
): Date {
  const byWindow = now.getTime() + windowHours * 60 * 60 * 1000;
  const eventStartWib = eventDate.getTime() - WIB_OFFSET_MS;
  const due = Math.min(byWindow, eventStartWib);
  return new Date(Math.max(due, now.getTime() + MIN_PAYMENT_WINDOW_MS));
}

/** Kunci baris availability lalu tambahkan reservedPax; melempar bila penuh. */
async function reserveCapacity(tx: Db, vendorId: string, eventDate: Date, guests: number) {
  const dayLiteral = toDateLiteral(eventDate);
  const availId = `av_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  await tx.$executeRaw`
    INSERT INTO "Availability" ("id", "vendorId", "date", "maxPax", "reservedPax")
    SELECT ${availId}, ${vendorId}, ${dayLiteral}::date,
      (SELECT "maxPax" FROM "VendorProfile" WHERE "id" = ${vendorId}), 0
    ON CONFLICT ("vendorId", "date") DO NOTHING`;
  const rows = await tx.$queryRaw<{ maxPax: number; reservedPax: number }[]>`
    SELECT "maxPax", "reservedPax" FROM "Availability"
    WHERE "vendorId" = ${vendorId} AND "date" = ${dayLiteral}::date FOR UPDATE`;
  const avail = rows[0];
  if (!avail || avail.reservedPax + guests > avail.maxPax) throw new Error(OVERBOOK_MSG);

  await tx.$executeRaw`
    UPDATE "Availability" SET "reservedPax" = "reservedPax" + ${guests}
    WHERE "vendorId" = ${vendorId} AND "date" = ${dayLiteral}::date`;
}

async function releaseCapacity(tx: Db, vendorId: string, eventDate: Date, guests: number) {
  const dayLiteral = toDateLiteral(eventDate);
  await tx.$executeRaw`
    UPDATE "Availability" SET "reservedPax" = GREATEST("reservedPax" - ${guests}, 0)
    WHERE "vendorId" = ${vendorId} AND "date" = ${dayLiteral}::date`;
}

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
    if (q.vendor.userId === customerId) throw new Error("Vendor tidak dapat memesan catering sendiri.");

    const guests = q.event.guestCount;
    await reserveCapacity(tx, q.vendorId, q.event.eventDate, guests);

    const claimed = await tx.quotation.updateMany({
      where: { id: q.id, status: { in: ["SENT", "REVISION_REQUESTED"] } },
      data: { status: "ACCEPTED" },
    });
    if (claimed.count === 0) throw new Error("Penawaran sudah diproses.");

    const now = new Date();
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
        confirmedAt: now,
        paymentDueAt: computePaymentDueAt(now, q.event.eventDate),
        invoiceNumber: await nextInvoiceNumber(tx, { id: q.vendorId, businessName: q.vendor.businessName }),
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
    await notify(tx, q.vendor.userId, {
      type: "BOOKING",
      title: "Penawaran diterima pelanggan",
      message: `Acara "${q.event.name}" (${guests} pax) menjadi pesanan. Menunggu pelanggan melunasi.`,
      link: "/vendor/orders",
      whatsapp: true,
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
      include: { event: true, items: true, vendor: { select: { userId: true, businessName: true } } },
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
    const guests = q.event.guestCount;
    await reserveCapacity(tx, q.vendorId, q.event.eventDate, guests);

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

    const now = new Date();
    const paymentDueAt = computePaymentDueAt(now, q.event.eventDate);
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
        confirmedAt: now,
        paymentDueAt,
        invoiceNumber: await nextInvoiceNumber(tx, { id: q.vendorId, businessName: q.vendor.businessName }),
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
    await notify(tx, q.customerId, {
      type: "BOOKING",
      title: "Pesanan dikonfirmasi vendor",
      message: `Pesanan "${q.event.name}" (${guests} pax) disetujui. Total nota ${total.toLocaleString("id-ID")} — lunasi sebelum batas waktu agar jadwal tidak dilepas.`,
      link: `/bookings/${booking.id}`,
      whatsapp: true,
    });
    return booking;
  });
}

// ---------------------------------------------------------------------------
// Pembatalan
// ---------------------------------------------------------------------------

export type CancelActor = "CUSTOMER" | "VENDOR" | "SYSTEM";

/** Pelanggan boleh membatalkan pesanan lunas paling lambat H-3 acara. */
export const CUSTOMER_CANCEL_MIN_DAYS = 3;

const UNPAID_CANCELLABLE = ["PAYMENT_PENDING", "CONFIRMED"];
const PAID_CANCELLABLE = ["PAID", "PREPARING"];

export type CancelDecision =
  | { ok: true; refund: boolean; nextStatus: "CANCELLED" | "REFUND_PENDING" }
  | { ok: false; message: string };

/**
 * Kebijakan pembatalan (murni, mudah diuji):
 *  - Belum lunas: pelanggan & vendor boleh membatalkan kapan saja.
 *  - Sudah lunas (PAID/PREPARING): vendor boleh, pelanggan hanya sampai H-3.
 *    Uang yang sudah masuk wajib dikembalikan → status REFUND_PENDING.
 *  - READY ke atas: makanan sudah jadi, tidak bisa dibatalkan lewat sistem.
 */
export function decideCancellation(input: {
  actor: CancelActor;
  status: string;
  paidAmount: number;
  daysUntilEvent: number;
  /** Pesanan offline: uang diterima langsung oleh vendor, jadi tidak lewat refund admin. */
  source?: string;
}): CancelDecision {
  const { actor, status, paidAmount, daysUntilEvent } = input;
  const isUnpaid = UNPAID_CANCELLABLE.includes(status);
  const isPaid = PAID_CANCELLABLE.includes(status);
  if (!isUnpaid && !isPaid) {
    return { ok: false, message: "Pesanan pada tahap ini tidak dapat dibatalkan." };
  }
  if (isPaid && actor === "CUSTOMER" && daysUntilEvent < CUSTOMER_CANCEL_MIN_DAYS) {
    return {
      ok: false,
      message: `Pesanan lunas hanya bisa dibatalkan paling lambat H-${CUSTOMER_CANCEL_MIN_DAYS}. Hubungi vendor melalui chat pesanan.`,
    };
  }
  const refund = paidAmount > 0 && input.source !== "OFFLINE";
  return { ok: true, refund, nextStatus: refund ? "REFUND_PENDING" : "CANCELLED" };
}

/**
 * Batalkan booking + lepas kapasitas + batalkan tagihan PENDING + notifikasi.
 * `expectStatus` dipakai sebagai klaim optimistik agar dua pembatalan/settlement
 * bersamaan tidak saling menimpa.
 */
async function applyCancellation(
  tx: Db,
  booking: {
    id: string;
    status: string;
    vendorId: string;
    customerId: string;
    event: { name: string; eventDate: Date; guestCount: number };
    vendor: { userId: string; businessName: string };
  },
  opts: { by: CancelActor; reason: string; refundAmount: number; extraWhere?: Record<string, unknown> },
) {
  const refund = opts.refundAmount > 0;
  const claimed = await tx.booking.updateMany({
    where: { id: booking.id, status: booking.status as never, ...(opts.extraWhere ?? {}) },
    data: {
      status: refund ? "REFUND_PENDING" : "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: opts.reason,
      cancelledBy: opts.by,
      refundAmount: refund ? opts.refundAmount : null,
    },
  });
  if (claimed.count === 0) return false;

  await releaseCapacity(tx, booking.vendorId, booking.event.eventDate, booking.event.guestCount);
  await tx.payment.updateMany({
    where: { bookingId: booking.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  const link = `/bookings/${booking.id}`;
  const refundNote = refund ? ` Dana ${opts.refundAmount.toLocaleString("id-ID")} akan dikembalikan.` : "";
  const byLabel = opts.by === "CUSTOMER" ? "pelanggan" : opts.by === "VENDOR" ? "vendor" : "sistem";
  const message = `Pesanan "${booking.event.name}" dibatalkan oleh ${byLabel}: ${opts.reason}.${refundNote}`;
  if (opts.by !== "CUSTOMER") {
    await notify(tx, booking.customerId, { type: "BOOKING", title: "Pesanan dibatalkan", message, link, whatsapp: true });
  }
  if (opts.by !== "VENDOR") {
    await notify(tx, booking.vendor.userId, { type: "BOOKING", title: "Pesanan dibatalkan", message, link, whatsapp: true });
  }
  if (refund) {
    await notifyAdmins(tx, {
      type: "REFUND",
      title: "Refund perlu diproses",
      message: `${booking.vendor.businessName} · "${booking.event.name}" — ${opts.refundAmount.toLocaleString("id-ID")}.`,
      link: "/admin/orders?filter=refund",
    });
  }
  return true;
}

const CANCEL_INCLUDE = {
  event: { select: { name: true, eventDate: true, guestCount: true } },
  vendor: { select: { userId: true, businessName: true } },
  payments: { where: { status: "SETTLEMENT" as const }, select: { amount: true } },
};

/** Pembatalan oleh pelanggan atau vendor pemilik pesanan. */
export async function cancelBooking(input: {
  bookingId: string;
  actor: { role: "CUSTOMER" | "VENDOR"; userId: string };
  reason: string;
  now?: Date;
}) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      include: CANCEL_INCLUDE,
    });
    if (!booking) throw new Error("Pesanan tidak ditemukan.");
    const owner = input.actor.role === "CUSTOMER" ? booking.customerId : booking.vendor.userId;
    if (owner !== input.actor.userId) throw new Error("Akses ditolak.");

    const paidAmount = booking.payments.reduce((s, p) => s + p.amount, 0);
    const decision = decideCancellation({
      actor: input.actor.role,
      status: booking.status,
      paidAmount,
      daysUntilEvent: diffInDays(booking.event.eventDate, todayDateOnly(input.now)),
      source: booking.source,
    });
    if (!decision.ok) throw new Error(decision.message);

    const applied = await applyCancellation(tx, booking, {
      by: input.actor.role,
      reason: input.reason,
      refundAmount: decision.refund ? paidAmount : 0,
    });
    if (!applied) throw new Error("Status pesanan baru saja berubah. Muat ulang halaman.");
    return { status: decision.nextStatus };
  });
}

/**
 * Batalkan otomatis booking yang melewati batas pelunasan, lepas kapasitasnya.
 * Mengembalikan jumlah booking yang dibatalkan.
 */
export async function expireUnpaidBookings(now = new Date()): Promise<number> {
  const due = await db.booking.findMany({
    where: { status: "PAYMENT_PENDING", paymentDueAt: { lt: now } },
    select: { id: true },
    take: 100,
  });
  let count = 0;
  for (const { id } of due) {
    const done = await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: CANCEL_INCLUDE });
      if (!booking || booking.status !== "PAYMENT_PENDING") return false;
      return applyCancellation(tx, booking, {
        by: "SYSTEM",
        reason: "batas waktu pembayaran terlewati",
        refundAmount: 0,
        extraWhere: { paymentDueAt: { lt: now } },
      });
    });
    if (done) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Pesanan offline (dicatat vendor dari WA/telepon)
// ---------------------------------------------------------------------------

export type OfflinePaymentMethod = "CASH" | "TRANSFER";

/** Akun tersembunyi pemilik semua pesanan offline satu vendor. */
async function offlineCustomer(tx: Db, vendor: { id: string; businessName: string }) {
  const email = `offline+${vendor.id}@caterhub.local`;
  return tx.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: `Pelanggan offline · ${vendor.businessName}`,
      role: "CUSTOMER",
      isPlaceholder: true,
      whatsappOptIn: false,
    },
    select: { id: true },
  });
}

async function createManualPayment(tx: Db, bookingId: string, amount: number, method: OfflinePaymentMethod) {
  await tx.payment.create({
    data: {
      bookingId,
      provider: "manual",
      providerReference: `MANUAL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
      amount,
      method,
      status: "SETTLEMENT",
      paidAt: new Date(),
    },
  });
}

export type OfflineOrderInput = {
  vendorUserId: string;
  customerName: string;
  customerPhone?: string | null;
  eventName: string;
  eventDate: Date;
  eventTime: string;
  guestCount: number;
  location: string;
  city: string;
  packageId: string;
  addOnIds: string[];
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  notes?: string | null;
  payment: "NONE" | OfflinePaymentMethod;
};

/**
 * Catat pesanan offline sebagai booking biasa (sumber OFFLINE): memotong
 * kapasitas, masuk kalender/produksi/invoice. Tidak ada batas bayar otomatis
 * karena pembayaran ditagih langsung oleh vendor.
 */
export async function createOfflineBooking(input: OfflineOrderInput) {
  return db.$transaction(async (tx) => {
    const vendor = await tx.vendorProfile.findUnique({
      where: { userId: input.vendorUserId },
      select: { id: true, businessName: true, userId: true },
    });
    if (!vendor) throw new Error("Profil vendor belum dibuat.");
    if (input.eventDate < todayDateOnly()) throw new Error("Tanggal acara sudah lewat.");

    const pkg = await tx.package.findFirst({ where: { id: input.packageId, vendorId: vendor.id } });
    if (!pkg) throw new Error("Paket tidak valid.");
    const addOnIds = [...new Set(input.addOnIds)];
    const addOns = addOnIds.length
      ? await tx.menuItem.findMany({
          where: { id: { in: addOnIds }, vendorId: vendor.id, price: { gt: 0 } },
          select: { id: true, name: true, price: true },
          orderBy: { name: "asc" },
        })
      : [];
    if (addOns.length !== addOnIds.length) throw new Error("Menu tambahan tidak valid.");

    const items = buildRequestItems(pkg, addOns, input.guestCount);
    const { subtotal, total } = calcTotals(items, input.deliveryFee, input.serviceFee, input.discount);
    if (total <= 0) throw new Error("Total nota harus lebih dari 0.");

    const customer = await offlineCustomer(tx, vendor);
    const event = await tx.event.create({
      data: {
        customerId: customer.id,
        name: input.eventName,
        eventType: "OTHER",
        eventDate: input.eventDate,
        eventTime: input.eventTime,
        location: input.location,
        city: input.city,
        guestCount: input.guestCount,
        notes: input.notes ?? undefined,
      },
    });
    const quotation = await tx.quotation.create({
      data: {
        eventId: event.id,
        packageId: pkg.id,
        vendorId: vendor.id,
        customerId: customer.id,
        origin: "VENDOR_OFFLINE",
        status: "ACCEPTED",
        subtotal,
        deliveryFee: input.deliveryFee,
        serviceFee: input.serviceFee,
        discount: input.discount,
        total,
        notes: input.notes ?? undefined,
        items: { create: items },
        history: {
          create: {
            actorId: vendor.userId,
            action: "created",
            toStatus: "ACCEPTED",
            note: `Pesanan offline dicatat vendor untuk ${input.customerName}.`,
          },
        },
      },
    });

    await reserveCapacity(tx, vendor.id, input.eventDate, input.guestCount);

    const paid = input.payment !== "NONE";
    const booking = await tx.booking.create({
      data: {
        eventId: event.id,
        quotationId: quotation.id,
        vendorId: vendor.id,
        customerId: customer.id,
        source: "OFFLINE",
        offlineCustomerName: input.customerName,
        offlineCustomerPhone: input.customerPhone || null,
        status: paid ? "PAID" : "PAYMENT_PENDING",
        totalAmount: total,
        depositAmount: total,
        remainingAmount: 0,
        confirmedAt: new Date(),
        paymentDueAt: null,
        invoiceNumber: await nextInvoiceNumber(tx, vendor),
      },
    });
    if (paid) await createManualPayment(tx, booking.id, total, input.payment as OfflinePaymentMethod);
    return booking;
  });
}

/** Vendor mencatat pelunasan tunai/transfer — hanya untuk pesanan offline. */
export async function recordOfflinePayment(bookingId: string, vendorUserId: string, method: OfflinePaymentMethod) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        vendor: { select: { userId: true } },
        payments: { where: { status: "SETTLEMENT" }, select: { amount: true } },
      },
    });
    if (!booking || booking.vendor.userId !== vendorUserId) throw new Error("Akses ditolak.");
    if (booking.source !== "OFFLINE") throw new Error("Pembayaran manual hanya untuk pesanan offline.");
    if (!["PAYMENT_PENDING", "CONFIRMED"].includes(booking.status)) throw new Error("Pesanan ini tidak menunggu pembayaran.");
    const remaining = booking.totalAmount - booking.payments.reduce((s, p) => s + p.amount, 0);
    if (remaining <= 0) throw new Error("Pesanan sudah lunas.");
    await createManualPayment(tx, booking.id, remaining, method);
    await tx.booking.update({ where: { id: booking.id }, data: { status: "PAID" } });
    return { amount: remaining };
  });
}

export const VALID_BOOKING_TRANSITIONS: Record<string, string[]> = {
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  CONFIRMED: ["PAYMENT_PENDING", "PAID", "CANCELLED"],
  PAID: ["PREPARING", "REFUND_PENDING"],
  PREPARING: ["READY", "REFUND_PENDING"],
  READY: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: ["REFUND_PENDING"], // pembayaran telat masuk setelah dibatalkan
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: ["REFUND_PENDING"],
  QUOTATION_PENDING: [],
  QUOTATION_SENT: [],
  REVISION_REQUESTED: [],
};

export function canTransitionBooking(from: string, to: string): boolean {
  return VALID_BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Status produksi yang boleh dimajukan vendor secara manual. `PAID` hanya dari
 * webhook pembayaran; pembatalan lewat `cancelBooking` (wajib alasan).
 */
export const VENDOR_MANUAL_BOOKING_TARGETS = ["PREPARING", "READY", "DELIVERED", "COMPLETED"] as const;

export function canVendorSetBookingStatus(to: string): boolean {
  return (VENDOR_MANUAL_BOOKING_TARGETS as readonly string[]).includes(to);
}

/** Status yang tidak dihitung sebagai pendapatan vendor/platform. */
export const NON_REVENUE_BOOKING_STATUSES = ["CANCELLED", "REFUND_PENDING", "REFUNDED"] as const;
