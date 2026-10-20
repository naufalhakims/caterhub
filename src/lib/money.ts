import { z } from "zod";

/**
 * Nilai uang disimpan sebagai bilangan bulat Rupiah (tanpa desimal).
 * Frontend menampilkan format "Rp10.000", tetapi yang dikirim ke server selalu
 * angka murni. parseIDR menerima angka maupun string berformat agar input yang
 * belum dinormalisasi (paste, autofill) tetap aman.
 */
export function parseIDR(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.trunc(input) : null;
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const negative = trimmed.startsWith("-");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Format angka untuk pratinjau/input: "10000" → "10.000". */
export function formatIDRInput(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : parseIDR(value);
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

const idrNumber = z
  .number({ invalid_type_error: "Nominal tidak valid.", required_error: "Nominal wajib diisi." })
  .int("Nominal harus bilangan bulat.")
  .min(0, "Nominal tidak boleh negatif.");

/** String kosong / null dianggap "tidak diisi" (bukan 0) agar .optional() bekerja. */
const toIdr = (v: unknown) => (v === "" || v == null ? undefined : (parseIDR(v) ?? Number.NaN));

/** Zod: terima nilai berformat ("Rp10.000") maupun angka, hasilkan integer Rupiah. */
export const zIdr = z.preprocess(toIdr, idrNumber);

/**
 * Seperti zIdr, tetapi boleh kosong. Penting: .optional() HARUS dipasang pada
 * schema angka di dalam preprocess — memasangnya di luar preprocess membuat string
 * kosong tidak pernah sampai ke tahap opsional.
 */
export const zIdrOptional = z.preprocess(toIdr, idrNumber.optional());

/** Seperti zIdr, dengan nilai cadangan saat field dibiarkan kosong. */
export function zIdrWithDefault(fallback = 0) {
  return z.preprocess(toIdr, idrNumber.default(fallback));
}
