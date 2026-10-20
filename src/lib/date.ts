// Utilitas tanggal "date-only" (tanpa jam) untuk zona waktu Indonesia.
//
// Aturan proyek: semua nilai tanggal (mis. Availability.date, Event.eventDate dari input
// <input type="date">) direpresentasikan sebagai UTC tengah malam. Ini membuat hasilnya
// identik baik server berjalan di Asia/Jakarta maupun di UTC, karena Prisma membaca dan
// menulis kolom @db.Date memakai komponen UTC dari objek Date.
export const JAKARTA_TZ = "Asia/Jakarta";

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse "YYYY-MM-DD" menjadi UTC tengah malam. Melempar error bila tidak valid. */
export function parseDateOnly(input: string): Date {
  const raw = input.trim();
  const m = DATE_ONLY_RE.exec(raw);
  if (!m) throw new Error(`Tanggal tidak valid: ${input}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Tanggal tidak valid: ${input}`);
  }
  return date;
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Normalisasi Date | string menjadi UTC tengah malam pada hari yang sama.
 * String "YYYY-MM-DD" diperlakukan sebagai tanggal literal; string timestamp lain
 * memakai komponen UTC-nya.
 */
export function toDateOnly(d: Date | string): Date {
  if (typeof d === "string") {
    if (DATE_ONLY_RE.test(d.trim())) return parseDateOnly(d);
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Tanggal tidak valid: ${d}`);
    return utcMidnight(parsed);
  }
  if (Number.isNaN(d.getTime())) throw new Error("Tanggal tidak valid.");
  return utcMidnight(d);
}

/** Tanggal kalender hari ini menurut zona Asia/Jakarta, sebagai UTC tengah malam. */
export function todayDateOnly(now: Date = new Date()): Date {
  return parseDateOnly(jakartaDateString(now));
}

/** "YYYY-MM-DD" menurut zona Asia/Jakarta. */
export function jakartaDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Selisih hari (a - b) untuk dua tanggal date-only. */
export function diffInDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
