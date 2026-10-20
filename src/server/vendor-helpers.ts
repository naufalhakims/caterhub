import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

/**
 * Hanya peran VENDOR yang boleh masuk area /vendor/*.
 * Admin tidak lagi diarahkan ke antarmuka vendor (lihat matriks akses di middleware);
 * peninjauan vendor dilakukan melalui /admin/vendors.
 */
export async function requireVendor() {
  const user = await requireRole("VENDOR");
  const vendor = await db.vendorProfile.findUnique({ where: { userId: user.id } });
  if (!vendor) redirect("/vendor/profile");
  return { user, vendor };
}
