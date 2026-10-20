import { z } from "zod";
import { db } from "@/lib/db";
import { toDateOnly } from "@/lib/format";
import { fetchVendorSearch, type VendorSearchResult } from "@/lib/vendor-api";

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

type VendorRow = {
  id: string;
  businessName: string;
  description: string | null;
  city: string;
  logoUrl: string | null;
  coverUrl: string | null;
  rating: number;
  reviewCount: number;
  minPax: number;
  maxPax: number;
  packages: { pricePerPax: number }[];
};

function toResult(
  v: VendorRow,
  availability: { maxPax: number; reservedPax: number } | undefined,
  f: SearchFilters,
): VendorSearchResult {
  const startingPrice = v.packages[0]?.pricePerPax ?? null;
  const maxPax = availability?.maxPax ?? v.maxPax;
  const reserved = availability?.reservedPax ?? 0;
  const remaining = maxPax - reserved;
  const guests = f.guests ?? 0;
  const hasCapacity = !f.date || !guests ? true : remaining >= guests;
  const capacityFit = !guests || (guests >= v.minPax && guests <= maxPax && remaining >= guests);
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
  return {
    id: v.id,
    businessName: v.businessName,
    city: v.city,
    rating: v.rating,
    reviewCount: v.reviewCount,
    startingPrice,
    remaining,
    hasCapacity,
    score,
    reasons,
    description: v.description,
    logoUrl: v.logoUrl,
    coverUrl: v.coverUrl,
  };
}

/**
 * POC pemisahan: bila API_BASE_URL diisi, data katalog diambil dari Express.
 * Bila tidak, tetap memakai Prisma langsung (jalur lama) agar POC bisa
 * dibatalkan hanya dengan menghapus satu variabel lingkungan.
 */
export async function searchVendors(raw: Record<string, string | undefined>) {
  const f = searchFilterSchema.parse({
    q: raw.q || undefined,
    city: raw.city || undefined,
    date: raw.date || undefined,
    guests: raw.guests || undefined,
    budgetMax: raw.budgetMax || undefined,
  });

  const remote = await fetchVendorSearch({
    q: f.q,
    city: f.city,
    date: f.date,
    guests: f.guests,
    budgetMax: f.budgetMax,
  });
  if (remote) return remote;

  return searchVendorsFromDb(f);
}

async function searchVendorsFromDb(f: SearchFilters) {
  const day = f.date ? toDateOnly(f.date) : null;
  const where = {
    verificationStatus: "VERIFIED" as const,
    ...(f.city ? { city: { contains: f.city, mode: "insensitive" as const } } : {}),
    ...(f.q
      ? {
          OR: [
            { businessName: { contains: f.q, mode: "insensitive" as const } },
            { description: { contains: f.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  if (day) {
    const vendors = await db.vendorProfile.findMany({
      where,
      include: {
        packages: { where: { isActive: true }, orderBy: { pricePerPax: "asc" }, take: 1 },
        availability: { where: { date: day } },
      },
      orderBy: { rating: "desc" },
      take: 50,
    });
    return vendors
      .map((v) => toResult(v, v.availability[0], f))
      .sort((a, b) => b.score - a.score);
  }

  const vendors = await db.vendorProfile.findMany({
    where,
    include: {
      packages: { where: { isActive: true }, orderBy: { pricePerPax: "asc" }, take: 1 },
    },
    orderBy: { rating: "desc" },
    take: 50,
  });
  return vendors.map((v) => toResult(v, undefined, f)).sort((a, b) => b.score - a.score);
}
