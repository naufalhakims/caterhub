import { z } from "zod";
import { apiGet } from "@/lib/api";
import type { VendorCardDto } from "@/lib/vendor-types";

export const searchFilterSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  guests: z.coerce.number().int().min(1).optional(),
  budgetMax: z.coerce.number().int().min(0).optional(),
});

export type SearchFilters = z.infer<typeof searchFilterSchema>;

/** Deterministic scoring (sama dengan backend; dipakai untuk unit test). */
export function scoreVendor(v: {
  hasCapacity: boolean;
  capacityFit: boolean;
  budgetFit: boolean | null;
  cityMatch: boolean | null;
  rating: number;
}): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (v.hasCapacity) {
    score += 30;
    reasons.push("Tersedia pada tanggal acara");
  }
  if (v.capacityFit) {
    score += 25;
    reasons.push("Kapasitas sesuai jumlah tamu");
  }
  if (v.budgetFit === true) {
    score += 20;
    reasons.push("Sesuai budget");
  } else if (v.budgetFit === null) {
    score += 10;
  }
  if (v.cityMatch === true) {
    score += 15;
    reasons.push("Lokasi dekat");
  } else if (v.cityMatch === null) {
    score += 7;
  }
  score += Math.min(10, Math.round(v.rating * 2));
  if (v.rating >= 4.5) reasons.push("Rating tinggi");
  return { score, reasons };
}

/**
 * Katalog sepenuhnya dari API. Frontend tidak lagi memiliki akses database
 * dan tidak punya fallback Prisma.
 */
export async function searchVendors(raw: Record<string, string | undefined>): Promise<VendorCardDto[]> {
  const f = searchFilterSchema.parse({
    q: raw.q || undefined,
    city: raw.city || undefined,
    date: raw.date || undefined,
    time: raw.time || undefined,
    guests: raw.guests || undefined,
    budgetMax: raw.budgetMax || undefined,
  });

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  return apiGet<VendorCardDto[]>(`/api/v1/vendors?${qs.toString()}`);
}
