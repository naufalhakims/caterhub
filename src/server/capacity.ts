import { db } from "@/lib/db";
import { toDateOnly } from "@/lib/format";

export const OVERBOOK_MSG = "Kapasitas vendor tidak mencukupi untuk jumlah pax yang dipilih.";

/** Konversi tanggal ke literal "YYYY-MM-DD" agar aman dipakai di raw SQL (tanpa pengaruh zona waktu). */
export function toDateLiteral(d: Date | string): string {
  return toDateOnly(d).toISOString().slice(0, 10);
}

export async function getAvailability(vendorId: string, date: Date | string) {
  const day = toDateOnly(date);
  const [row, vendor] = await Promise.all([
    db.availability.findUnique({ where: { vendorId_date: { vendorId, date: day } } }),
    db.vendorProfile.findUniqueOrThrow({ where: { id: vendorId }, select: { maxPax: true } }),
  ]);
  const maxPax = row?.maxPax ?? vendor.maxPax;
  const reservedPax = row?.reservedPax ?? 0;
  return { date: day, maxPax, reservedPax, remaining: maxPax - reservedPax };
}

export async function checkCapacity(vendorId: string, date: Date | string, requestedPax: number) {
  const a = await getAvailability(vendorId, date);
  return { ...a, ok: a.remaining >= requestedPax };
}

/**
 * Simpan kapasitas harian vendor. Validasi utama: kapasitas baru tidak boleh lebih
 * kecil dari pax yang sudah terpesan pada tanggal tersebut (mencegah data tidak konsisten).
 */
export async function setDailyCapacity(vendorId: string, dateInput: string, maxPax: number) {
  const day = toDateOnly(dateInput);
  return db.$transaction(async (tx) => {
    const existing = await tx.availability.findUnique({
      where: { vendorId_date: { vendorId, date: day } },
    });
    const reserved = existing?.reservedPax ?? 0;
    if (maxPax < reserved) {
      throw new Error(
        `Kapasitas tidak boleh lebih kecil dari ${reserved} pax yang sudah terpesan pada tanggal ini.`,
      );
    }
    return tx.availability.upsert({
      where: { vendorId_date: { vendorId, date: day } },
      update: { maxPax },
      create: { vendorId, date: day, maxPax, reservedPax: 0 },
    });
  });
}
