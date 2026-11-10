import { db } from "../db";
import { toDateOnly, todayDateOnly } from "../lib/date";
import { notify } from "./notify";

/**
 * Progres pesanan setelah lunas — sebisa mungkin otomatis:
 *  - Lunas → Dimasak: otomatis 00:00 WIB hari acara (atau "Mulai masak semua").
 *  - Dimasak → Sedang diantar: satu klik vendor "Berangkat antar" (READY dilewati).
 *  - Sedang diantar → Selesai: pelanggan "Pesanan sudah diterima", atau otomatis
 *    24 jam setelah jam acara.
 *  - Pengingat ke vendor bila jam acara lewat tetapi pesanan belum berangkat.
 */

const WIB_OFFSET_MS = 7 * 3_600_000;
export const AUTO_COMPLETE_AFTER_MS = 24 * 3_600_000;
const DEFAULT_EVENT_HOUR = 12;

/** Status yang boleh ditandai "berangkat antar" oleh vendor. */
export const DEPARTABLE_STATUSES = ["PAID", "PREPARING", "READY"] as const;
/** Status yang boleh dikonfirmasi "sudah diterima" oleh pelanggan. */
export const RECEIVABLE_STATUSES = ["PAID", "PREPARING", "READY", "DELIVERED"] as const;
/** Masih dalam proses dapur/antar — kandidat pengingat & selesai otomatis. */
const IN_PROGRESS = ["PREPARING", "READY", "DELIVERED"] as const;

/**
 * Waktu mulai acara (instant UTC). `eventTime` bebas ("10:00", "10.00–14.00",
 * "jam 7 malam" → default 12:00) — diambil jam:menit pertama yang valid.
 */
export function eventStartAt(eventDate: Date, eventTime: string | null | undefined): Date {
  const m = /(\d{1,2})[:.](\d{2})/.exec(eventTime ?? "");
  let hour = DEFAULT_EVENT_HOUR;
  let minute = 0;
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
    hour = Number(m[1]);
    minute = Number(m[2]);
  }
  return new Date(eventDate.getTime() + (hour * 60 + minute) * 60_000 - WIB_OFFSET_MS);
}

const DAY_MS = 86_400_000;

/**
 * Vendor baru boleh memajukan progres ("Berangkat antar", "Tandai selesai") mulai
 * H-1 acara (tanggal WIB), agar pesanan tidak ditandai selesai jauh sebelum acaranya.
 */
export function vendorAdvanceOpensOn(eventDate: Date): Date {
  return new Date(toDateOnly(eventDate).getTime() - DAY_MS);
}

export function canVendorAdvance(eventDate: Date, today: Date): boolean {
  return today.getTime() >= vendorAdvanceOpensOn(eventDate).getTime();
}

/** Pelanggan boleh konfirmasi terima bila sudah diantar, atau sudah tiba hari acara. */
export function canConfirmReceipt(status: string, eventDate: Date, today: Date): boolean {
  if (!(RECEIVABLE_STATUSES as readonly string[]).includes(status)) return false;
  return status === "DELIVERED" || eventDate.getTime() <= today.getTime();
}

// ---------------------------------------------------------------------------
// Aksi pengguna
// ---------------------------------------------------------------------------

/** Vendor: "Berangkat antar" → Sedang diantar + WA ke pelanggan. */
export async function markDeparted(bookingId: string, vendorUserId: string) {
  return db.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, customerId: true, vendor: { select: { userId: true, businessName: true } }, event: { select: { name: true } } },
    });
    if (!b || b.vendor.userId !== vendorUserId) throw new Error("Akses ditolak.");
    const claimed = await tx.booking.updateMany({
      where: { id: b.id, status: { in: [...DEPARTABLE_STATUSES] } },
      data: { status: "DELIVERED", departedAt: new Date() },
    });
    if (claimed.count === 0) throw new Error("Pesanan ini tidak bisa ditandai berangkat (sudah diantar, selesai, atau belum lunas).");
    await notify(tx, b.customerId, {
      type: "DELIVERY",
      title: "Pesanan sedang diantar",
      message: `${b.vendor.businessName} sedang mengantar pesanan "${b.event.name}". Tekan "Pesanan sudah diterima" saat makanan tiba.`,
      link: `/bookings/${b.id}`,
      whatsapp: true,
    });
  });
}

/** Pelanggan: "Pesanan sudah diterima" → Selesai (lalu bisa memberi ulasan). */
export async function confirmReceipt(bookingId: string, customerUserId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, customerId: true, vendor: { select: { userId: true } }, event: { select: { name: true, eventDate: true } } },
    });
    if (!b || b.customerId !== customerUserId) throw new Error("Akses ditolak.");
    if (!canConfirmReceipt(b.status, b.event.eventDate, todayDateOnly(now))) {
      throw new Error("Konfirmasi penerimaan tersedia saat pesanan diantar atau pada hari acara.");
    }
    const claimed = await tx.booking.updateMany({
      where: { id: b.id, status: { in: [...RECEIVABLE_STATUSES] } },
      data: { status: "COMPLETED", receivedAt: now, completedBy: "CUSTOMER" },
    });
    if (claimed.count === 0) throw new Error("Status pesanan baru saja berubah. Muat ulang halaman.");
    await notify(tx, b.vendor.userId, {
      type: "DELIVERY",
      title: "Pesanan diterima pelanggan",
      message: `Pelanggan mengonfirmasi "${b.event.name}" sudah diterima. Pesanan selesai.`,
      link: `/bookings/${b.id}`,
    });
  });
}

/** Vendor: "Mulai masak semua" untuk satu tanggal produksi. */
export async function startCookingForDate(vendorUserId: string, eventDate: Date) {
  const vendor = await db.vendorProfile.findUnique({ where: { userId: vendorUserId }, select: { id: true } });
  if (!vendor) throw new Error("Profil vendor belum dibuat.");
  const r = await db.booking.updateMany({
    where: { vendorId: vendor.id, status: "PAID", event: { eventDate } },
    data: { status: "PREPARING" },
  });
  return r.count;
}

// ---------------------------------------------------------------------------
// Otomatis (dipanggil penjadwal)
// ---------------------------------------------------------------------------

/** 00:00 WIB hari acara: Lunas → Dimasak, lalu ringkasan pagi per vendor. */
export async function autoStartCooking(now = new Date()): Promise<number> {
  const today = todayDateOnly(now);
  const due = await db.booking.findMany({
    where: { status: "PAID", event: { eventDate: { lte: today } } },
    select: { id: true, vendorId: true, vendor: { select: { userId: true } }, event: { select: { eventDate: true, guestCount: true } } },
    take: 500,
  });
  if (due.length === 0) return 0;
  const r = await db.booking.updateMany({ where: { id: { in: due.map((b) => b.id) }, status: "PAID" }, data: { status: "PREPARING" } });

  // Satu ringkasan per vendor, hanya untuk pesanan hari ini (bukan yang terlewat).
  const todayIso = today.toISOString().slice(0, 10);
  const perVendor = new Map<string, { orders: number; pax: number }>();
  for (const b of due) {
    if (b.event.eventDate.toISOString().slice(0, 10) !== todayIso) continue;
    const v = perVendor.get(b.vendor.userId) ?? { orders: 0, pax: 0 };
    v.orders++;
    v.pax += b.event.guestCount;
    perVendor.set(b.vendor.userId, v);
  }
  for (const [userId, v] of perVendor) {
    await notify(db, userId, {
      type: "PRODUCTION",
      title: "Produksi hari ini dimulai",
      message: `${v.orders} pesanan (${v.pax.toLocaleString("id-ID")} porsi) masuk tahap masak hari ini. Cek porsi, daftar belanja, dan jadwal kirim.`,
      link: `/vendor/production?date=${todayIso}`,
      whatsapp: true,
    });
  }
  return r.count;
}

/** Jam acara lewat tetapi belum berangkat → ingatkan vendor (sekali). */
export async function remindLateDelivery(now = new Date()): Promise<number> {
  const candidates = await db.booking.findMany({
    where: { status: { in: ["PAID", "PREPARING", "READY"] }, lateReminderSentAt: null, event: { eventDate: { lte: todayDateOnly(now) } } },
    select: { id: true, vendor: { select: { userId: true } }, event: { select: { name: true, eventDate: true, eventTime: true } } },
    take: 200,
  });
  let count = 0;
  for (const b of candidates) {
    if (eventStartAt(b.event.eventDate, b.event.eventTime) > now) continue;
    const claimed = await db.booking.updateMany({ where: { id: b.id, lateReminderSentAt: null }, data: { lateReminderSentAt: now } });
    if (claimed.count === 0) continue;
    await notify(db, b.vendor.userId, {
      type: "DELIVERY",
      title: "Jam acara sudah lewat",
      message: `"${b.event.name}" belum ditandai berangkat antar. Tekan "Berangkat antar" agar pelanggan bisa mengonfirmasi penerimaan.`,
      link: `/bookings/${b.id}`,
      whatsapp: true,
    });
    count++;
  }
  return count;
}

/** 24 jam setelah jam acara tanpa konfirmasi → Selesai otomatis. */
export async function autoCompleteBookings(now = new Date()): Promise<number> {
  const candidates = await db.booking.findMany({
    where: {
      status: { in: [...IN_PROGRESS] },
      event: { eventDate: { lte: todayDateOnly(now) } },
    },
    select: { id: true, customerId: true, source: true, event: { select: { name: true, eventDate: true, eventTime: true } } },
    take: 200,
  });
  let count = 0;
  for (const b of candidates) {
    if (eventStartAt(b.event.eventDate, b.event.eventTime).getTime() + AUTO_COMPLETE_AFTER_MS > now.getTime()) continue;
    const claimed = await db.booking.updateMany({
      where: { id: b.id, status: { in: [...IN_PROGRESS] } },
      data: { status: "COMPLETED", completedBy: "SYSTEM" },
    });
    if (claimed.count === 0) continue;
    count++;
    if (b.source !== "OFFLINE") {
      await notify(db, b.customerId, {
        type: "REVIEW_PROMPT",
        title: "Bagaimana pesanan Anda?",
        message: `Pesanan "${b.event.name}" sudah selesai. Bantu UMKM lain dengan memberi ulasan singkat.`,
        link: `/bookings/${b.id}`,
      });
    }
  }
  return count;
}
