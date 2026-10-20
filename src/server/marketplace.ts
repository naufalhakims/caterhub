import { z } from "zod";
import { db } from "@/lib/db";
import { toDateOnly } from "@/lib/format";

export const searchFilterSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD
  guests: z.coerce.number().int().min(1).optional(),
  budgetMax: z.coerce.number().int().min(0).optional(), // total budget
});

export type SearchFilters = z.infer<typeof searchFilterSchema>;

// Deterministic scoring: availability 30, capacity 25, budget 20, location 15, rating 10.
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

export async function searchVendors(raw: Record<string, string | undefined>) {
  const f = searchFilterSchema.parse({
    q: raw.q || undefined,
    city: raw.city || undefined,
    date: raw.date || undefined,
    guests: raw.guests || undefined,
    budgetMax: raw.budgetMax || undefined,
  });
  const day = f.date ? toDateOnly(f.date) : null;

  const vendors = day
    ? await db.vendorProfile.findMany({
        where: {
          verificationStatus: "VERIFIED",
          ...(f.city ? { city: { contains: f.city, mode: "insensitive" } } : {}),
          ...(f.q
            ? {
                OR: [
                  { businessName: { contains: f.q, mode: "insensitive" } },
                  { description: { contains: f.q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          packages: { where: { isActive: true }, orderBy: { pricePerPax: "asc" }, take: 1 },
          availability: { where: { date: day } },
        },
        orderBy: { rating: "desc" },
        take: 50,
      })
    : await db.vendorProfile.findMany({
        where: {
          verificationStatus: "VERIFIED",
          ...(f.city ? { city: { contains: f.city, mode: "insensitive" } } : {}),
          ...(f.q
            ? {
                OR: [
                  { businessName: { contains: f.q, mode: "insensitive" } },
                  { description: { contains: f.q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          packages: { where: { isActive: true }, orderBy: { pricePerPax: "asc" }, take: 1 },
        },
        orderBy: { rating: "desc" },
        take: 50,
      });

  return vendors.map((v) => {
    const startingPrice = v.packages[0]?.pricePerPax ?? null;
    const avail =
      "availability" in v && Array.isArray((v as { availability?: unknown }).availability)
        ? (v as unknown as { availability: { maxPax: number; reservedPax: number }[] }).availability[0]
        : null;
    const maxPax = avail?.maxPax ?? v.maxPax;
    const reserved = avail?.reservedPax ?? 0;
    const remaining = maxPax - reserved;
    const guests = f.guests ?? 0;
    const hasCapacity = !day || !guests ? true : remaining >= guests;
    const capacityFit =
      !guests || (guests >= v.minPax && guests <= maxPax && remaining >= guests);
    const budgetFit =
      f.budgetMax == null || !guests || startingPrice == null
        ? null
        : startingPrice * guests <= f.budgetMax;
    const cityMatch = !f.city ? null : v.city.toLowerCase() === f.city.toLowerCase();
    const { score, reasons } = scoreVendor({
      hasCapacity,
      capacityFit,
      budgetFit,
      cityMatch,
      rating: v.rating,
    });
    return { ...v, startingPrice, remaining, hasCapacity, score, reasons };
  }).sort((a, b) => b.score - a.score);
}
