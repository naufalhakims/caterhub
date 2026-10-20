import { JAKARTA_TZ, parseDateOnly } from "@/lib/date";

export { parseDateOnly, toDateOnly, todayDateOnly, jakartaDateString, JAKARTA_TZ } from "@/lib/date";

export function formatIDR(n: number): string {
  // id-ID kadang menghasilkan "Rp 10.000" (spasi/nbsp); brief meminta "Rp10.000".
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace(/\u00a0/g, "")
    .replace(/^Rp\s+/, "Rp");
}

/** Format tanggal-waktu dalam zona Asia/Jakarta (dipakai untuk Event.eventDate dsb). */
export function formatDateID(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: JAKARTA_TZ,
  }).format(dt);
}

/** Tanggal + jam dalam zona Asia/Jakarta (untuk riwayat chat, dsb). */
export function formatDateTimeID(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: JAKARTA_TZ,
  }).format(dt);
}

/**
 * Format nilai date-only (mis. Availability.date) memakai zona UTC agar tidak
 * bergeser satu hari di server dengan offset waktu berbeda.
 */
export function formatDateOnlyID(d: Date | string): string {
  const dt = typeof d === "string" ? parseDateOnly(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}
