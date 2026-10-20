/**
 * DTO publik katalog vendor. Jangan menambahkan field internal
 * (userId, verificationNote, reviewedById, dokumen) ke sini.
 */
export type VendorCardDto = {
  id: string;
  businessName: string;
  city: string;
  rating: number;
  reviewCount: number;
  startingPrice: number | null;
  remaining: number;
  hasCapacity: boolean;
  score: number;
  reasons: string[];
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
};

export type VendorPackageItemDto = {
  id: string;
  name: string;
  category: string;
};

export type VendorPackageDto = {
  id: string;
  name: string;
  description: string | null;
  pricePerPax: number;
  minPax: number;
  maxPax: number;
  imageUrl: string | null;
  items: VendorPackageItemDto[];
};

export type VendorMenuDto = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  imageUrl: string | null;
};

export type VendorReviewDto = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string | null;
};

export type VendorDetailDto = {
  id: string;
  businessName: string;
  description: string | null;
  city: string;
  address: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  gallery: string[];
  rating: number;
  reviewCount: number;
  minPax: number;
  maxPax: number;
  packages: VendorPackageDto[];
  menuItems: VendorMenuDto[];
  reviews: VendorReviewDto[];
};

export type VendorRepository = {
  search(filters: import("./filters").SearchFilters): Promise<VendorCardDto[]>;
  getById(id: string): Promise<VendorDetailDto | null>;
};
