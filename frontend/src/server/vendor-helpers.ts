import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth-helpers";

export type VendorProfile = {
  id: string;
  businessName: string;
  description: string | null;
  city: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  gallery: string[];
  rating: number;
  reviewCount: number;
  minPax: number;
  maxPax: number;
  verificationStatus: string;
  verificationNote: string | null;
  reviewedAt: string | null;
};

/**
 * Hanya peran VENDOR yang boleh masuk area /vendor/*.
 * Profil vendor diambil dari API (frontend tidak mengakses database).
 */
export async function requireVendor() {
  const user = await requireRole("VENDOR");
  const { vendor } = await apiGet<{ vendor: VendorProfile | null }>("/api/v1/vendor/me");
  if (!vendor) redirect("/vendor/profile");
  return { user, vendor };
}
