import { db } from "../db";
import { todayDateOnly } from "../lib/date";
import { expireUnpaidBookings } from "./booking";
import { notify } from "./notify";
import { autoCompleteBookings, autoStartCooking, remindLateDelivery } from "./progress";

const OPEN_QUOTATION_STATUSES = ["REQUESTED", "SENT", "REVISION_REQUESTED"] as const;

/**
 * Permintaan/penawaran yang tanggal acaranya sudah lewat atau masa berlakunya
 * habis → EXPIRED, agar dashboard vendor tidak penuh permintaan basi.
 */
export async function expireStaleQuotations(now = new Date()): Promise<number> {
  const today = todayDateOnly(now);
  const stale = await db.quotation.findMany({
    where: {
      status: { in: [...OPEN_QUOTATION_STATUSES] },
      OR: [{ event: { eventDate: { lt: today } } }, { expiresAt: { lt: now } }],
    },
    select: { id: true, status: true, customerId: true, event: { select: { name: true } } },
    take: 200,
  });
  let count = 0;
  for (const q of stale) {
    const done = await db.$transaction(async (tx) => {
      const claimed = await tx.quotation.updateMany({
        where: { id: q.id, status: q.status },
        data: { status: "EXPIRED" },
      });
      if (claimed.count === 0) return false;
      await tx.quotationHistory.create({
        data: {
          quotationId: q.id,
          action: "expired",
          fromStatus: q.status,
          toStatus: "EXPIRED",
          note: "Kedaluwarsa otomatis: tanggal acara atau masa berlaku sudah lewat.",
        },
      });
      await notify(tx, q.customerId, {
        type: "QUOTATION",
        title: "Permintaan kedaluwarsa",
        message: `Permintaan untuk "${q.event.name}" kedaluwarsa karena belum diproses sebelum tanggalnya.`,
        link: `/quotations/${q.id}`,
      });
      return true;
    });
    if (done) count++;
  }
  return count;
}

/** Kirim pengingat ±3 jam sebelum batas pelunasan (sekali per booking). */
export const PAYMENT_REMINDER_LEAD_MS = 3 * 60 * 60 * 1000;
/** Jangan ingatkan booking yang baru saja dibuat (jendela bayarnya memang pendek). */
const REMINDER_MIN_AGE_MS = 30 * 60 * 1000;

export async function remindUpcomingPaymentDue(now = new Date()): Promise<number> {
  const due = await db.booking.findMany({
    where: {
      status: "PAYMENT_PENDING",
      paymentReminderSentAt: null,
      paymentDueAt: { gt: now, lte: new Date(now.getTime() + PAYMENT_REMINDER_LEAD_MS) },
      createdAt: { lte: new Date(now.getTime() - REMINDER_MIN_AGE_MS) },
    },
    select: { id: true, customerId: true, paymentDueAt: true, totalAmount: true, event: { select: { name: true } } },
    take: 100,
  });
  let count = 0;
  for (const b of due) {
    const done = await db.$transaction(async (tx) => {
      const claimed = await tx.booking.updateMany({
        where: { id: b.id, paymentReminderSentAt: null, status: "PAYMENT_PENDING" },
        data: { paymentReminderSentAt: now },
      });
      if (claimed.count === 0) return false;
      const time = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(b.paymentDueAt!);
      await notify(tx, b.customerId, {
        type: "PAYMENT_REMINDER",
        title: "Pengingat: segera lunasi pesanan",
        message: `Pesanan "${b.event.name}" (${b.totalAmount.toLocaleString("id-ID")}) belum dibayar. Batas pelunasan ${time} WIB. Setelah itu jadwal vendor dilepas.`,
        link: `/bookings/${b.id}`,
        whatsapp: true,
      });
      return true;
    });
    if (done) count++;
  }
  return count;
}

export async function runExpirySweep(now = new Date()) {
  const reminders = await remindUpcomingPaymentDue(now);
  const bookings = await expireUnpaidBookings(now);
  const quotations = await expireStaleQuotations(now);
  // Progres pasca-lunas otomatis.
  const cooking = await autoStartCooking(now);
  const lateReminders = await remindLateDelivery(now);
  const completed = await autoCompleteBookings(now);
  return { reminders, bookings, quotations, cooking, lateReminders, completed };
}

const SWEEP_THROTTLE_MS = 60_000;
let lastSweep = 0;
let running: Promise<unknown> | null = null;

/**
 * Sapuan "lazy" sebelum membaca data yang bergantung pada status (dashboard,
 * daftar pesanan). Dibatasi sekali per menit per proses; kegagalan tidak
 * menggagalkan request pembaca.
 */
export async function maybeSweep(): Promise<void> {
  const now = Date.now();
  if (running) {
    await running.catch(() => undefined);
    return;
  }
  if (now - lastSweep < SWEEP_THROTTLE_MS) return;
  lastSweep = now;
  running = runExpirySweep().catch((error) => console.error("[api] expiry sweep gagal:", error));
  try {
    await running;
  } finally {
    running = null;
  }
}

/** Penjadwal berkala; `unref` agar tidak menahan proses saat shutdown. */
export function startExpiryScheduler(intervalMs = 5 * 60_000) {
  const tick = () => void maybeSweep();
  setTimeout(tick, 5_000).unref();
  return setInterval(tick, intervalMs).unref();
}
