import type { Db } from "./notify";
import { jakartaDateString } from "../lib/date";

/** Inisial nama usaha untuk prefiks invoice: "Dapur Nusantara" → "DN" (maks. 4 huruf). */
export function vendorInvoicePrefix(businessName: string): string {
  const words = businessName
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.map((w) => w[0]!.toUpperCase()).join("").slice(0, 4);
  if (initials.length >= 2) return initials;
  const single = (words[0] ?? "VND").toUpperCase();
  return single.slice(0, 3).padEnd(2, "X");
}

/** INV/DN/2026/0007 */
export function formatInvoiceNumber(prefix: string, year: number, seq: number): string {
  return `INV/${prefix}/${year}/${String(seq).padStart(4, "0")}`;
}

/**
 * Nomor invoice berikutnya untuk vendor (urut per tahun WIB). Inkremen atomik
 * lewat INSERT … ON CONFLICT agar dua pesanan bersamaan tidak mendapat nomor sama.
 */
export async function nextInvoiceNumber(tx: Db, vendor: { id: string; businessName: string }, now = new Date()) {
  const year = Number(jakartaDateString(now).slice(0, 4));
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "InvoiceCounter" ("vendorId", "year", "last") VALUES (${vendor.id}, ${year}, 1)
    ON CONFLICT ("vendorId", "year") DO UPDATE SET "last" = "InvoiceCounter"."last" + 1
    RETURNING "last"`;
  return formatInvoiceNumber(vendorInvoicePrefix(vendor.businessName), year, rows[0]!.last);
}

/** Pastikan booking punya nomor invoice (untuk booking lama sebelum fitur ini). */
export async function ensureInvoiceNumber(tx: Db, bookingId: string): Promise<string> {
  const b = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { invoiceNumber: true, vendor: { select: { id: true, businessName: true } } },
  });
  if (b.invoiceNumber) return b.invoiceNumber;
  const number = await nextInvoiceNumber(tx, b.vendor);
  const claimed = await tx.booking.updateMany({ where: { id: bookingId, invoiceNumber: null }, data: { invoiceNumber: number } });
  if (claimed.count === 0) {
    // Diterbitkan bersamaan oleh request lain; pakai nomor yang tersimpan.
    return (await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { invoiceNumber: true } })).invoiceNumber!;
  }
  return number;
}
