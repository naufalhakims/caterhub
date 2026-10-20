import { db } from "../db";
import type { SearchFilters } from "./filters";
import { toDateOnly } from "./filters";
import { scoreVendor } from "./scoring";
import type { VendorCardDto, VendorDetailDto, VendorRepository } from "./dto";

const ACTIVE_PACKAGES = {
  where: { isActive: true },
  orderBy: { pricePerPax: "asc" },
  take: 1,
} as const;

function baseWhere(filters: SearchFilters) {
  return {
    verificationStatus: "VERIFIED" as const,
    ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" as const } } : {}),
    ...(filters.q
      ? {
          OR: [
            { businessName: { contains: filters.q, mode: "insensitive" as const } },
            { description: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

function toCard(
  v: {
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
  },
  availability: { maxPax: number; reservedPax: number } | undefined,
  filters: SearchFilters,
): VendorCardDto {
  const startingPrice = v.packages[0]?.pricePerPax ?? null;
  const maxPax = availability?.maxPax ?? v.maxPax;
  const remaining = maxPax - (availability?.reservedPax ?? 0);
  const guests = filters.guests ?? 0;
  const hasCapacity = availability ? remaining >= guests : true;
  const capacityFit = !guests || (guests >= v.minPax && guests <= maxPax && remaining >= guests);
  const budgetFit =
    filters.budgetMax == null || !guests || startingPrice == null
      ? null
      : startingPrice * guests <= filters.budgetMax;
  const cityMatch = !filters.city ? null : v.city.toLowerCase() === filters.city.toLowerCase();
  const { score, reasons } = scoreVendor({ hasCapacity, capacityFit, budgetFit, cityMatch, rating: v.rating });

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

export const prismaVendorRepository: VendorRepository = {
  async search(filters) {
    const day = filters.date ? toDateOnly(filters.date) : null;

    // Dua query terpisah agar tipe `include` tetap sempit (bukan include kondisional).
    if (day) {
      const rows = await db.vendorProfile.findMany({
        where: baseWhere(filters),
        include: {
          packages: ACTIVE_PACKAGES,
          availability: { where: { date: day } },
        },
        orderBy: { rating: "desc" },
        take: 50,
      });
      return rows
        .map((v) => toCard(v, v.availability[0], filters))
        .sort((a, b) => b.score - a.score);
    }

    const rows = await db.vendorProfile.findMany({
      where: baseWhere(filters),
      include: { packages: ACTIVE_PACKAGES },
      orderBy: { rating: "desc" },
      take: 50,
    });
    return rows
      .map((v) => toCard(v, undefined, filters))
      .sort((a, b) => b.score - a.score);
  },

  async getById(id): Promise<VendorDetailDto | null> {
    const v = await db.vendorProfile.findFirst({
      where: { id, verificationStatus: "VERIFIED" },
      include: {
        packages: {
          where: { isActive: true },
          orderBy: { pricePerPax: "asc" },
          include: {
            items: {
              include: {
                menuItem: { select: { id: true, name: true, category: true } },
              },
            },
          },
        },
        menuItems: { where: { isAvailable: true }, orderBy: [{ category: "asc" }, { name: "asc" }] },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { customer: { select: { name: true } } },
        },
      },
    });
    if (!v) return null;

    return {
      id: v.id,
      businessName: v.businessName,
      description: v.description,
      city: v.city,
      address: v.address,
      phone: v.phone,
      logoUrl: v.logoUrl,
      coverUrl: v.coverUrl,
      gallery: v.gallery,
      rating: v.rating,
      reviewCount: v.reviewCount,
      minPax: v.minPax,
      maxPax: v.maxPax,
      packages: v.packages.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        pricePerPax: p.pricePerPax,
        minPax: p.minPax,
        maxPax: p.maxPax,
        imageUrl: p.imageUrl,
        items: p.items.map((it) => ({
          id: it.menuItem.id,
          name: it.menuItem.name,
          category: it.menuItem.category,
        })),
      })),
      menuItems: v.menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        category: m.category,
        price: m.price,
        imageUrl: m.imageUrl,
      })),
      reviews: v.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        customerName: r.customer.name,
      })),
    };
  },
};
