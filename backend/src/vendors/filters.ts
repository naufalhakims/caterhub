import { z } from "zod";

/** Tanggal date-only "YYYY-MM-DD" yang benar-benar ada di kalender. */
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Normalisasi string kosong dari query string menjadi undefined. */
const emptyToUndefined = (v: unknown) => (v === "" || v == null ? undefined : v);

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const searchFilterSchema = z.object({
  q: optionalText(100),
  city: optionalText(50),
  date: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine(isDateOnly, "Format tanggal harus YYYY-MM-DD dan valid.")
      .optional(),
  ),
  time: optionalText(20),
  guests: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1, "Jumlah tamu minimal 1.").max(100_000).optional(),
  ),
  budgetMax: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0, "Budget tidak boleh negatif.").optional(),
  ),
});

export type SearchFilters = z.infer<typeof searchFilterSchema>;

/**
 * Query Express bertipe string | string[] | ParsedQs. Ambil hanya nilai skalar;
 * array/objek diabaikan agar tidak membingungkan validasi.
 */
export function parseSearchFilters(query: Record<string, unknown>): SearchFilters {
  const pick = (key: string) => {
    const value = query[key];
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      // Query ganda (mis. ?city=A&city=) → pakai nilai non-kosong terakhir.
      const strings = value.filter((v): v is string => typeof v === "string" && v !== "");
      return strings.length ? strings[strings.length - 1] : undefined;
    }
    return undefined;
  };
  return searchFilterSchema.parse({
    q: pick("q"),
    city: pick("city"),
    date: pick("date"),
    time: pick("time"),
    guests: pick("guests"),
    budgetMax: pick("budgetMax") ?? pick("budget"),
  });
}

/** Ubah tanggal date-only menjadi Date UTC tengah malam (Prisma @db.Date). */
export function toDateOnly(value: string | Date): Date {
  const iso = typeof value === "string" ? value : value.toISOString().slice(0, 10);
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}
