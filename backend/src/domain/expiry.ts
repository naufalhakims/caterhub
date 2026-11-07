import { db } from "../db";
import { todayDateOnly } from "../lib/date";
import { expireUnpaidBookings } from "./booking";
import { notify } from "./notify";

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

export async function runExpirySweep(now = new Date()) {
  const bookings = await expireUnpaidBookings(now);
  const quotations = await expireStaleQuotations(now);
  return { bookings, quotations };
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
