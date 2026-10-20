"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiDelete, apiForm } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";

function revalidatePublic(vendorId: string) {
  revalidatePath("/vendor/profile");
  revalidatePath("/catering");
  revalidatePath(`/catering/${vendorId}`);
  revalidatePath("/");
}

/** Unggah logo, cover, atau foto galeri. FormData diteruskan ke API. */
export async function uploadVendorImageAction(formData: FormData): Promise<never> {
  const { vendor } = await requireVendor();
  try {
    await apiForm("/api/v1/vendor/images", formData);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Gambar tidak valid.";
    redirect(`/vendor/profile?error=${encodeURIComponent(message)}`);
  }
  revalidatePublic(vendor.id);
  redirect("/vendor/profile?ok=Gambar berhasil diunggah.");
}

export async function removeVendorImageAction(formData: FormData): Promise<never> {
  const { vendor } = await requireVendor();
  const kind = String(formData.get("kind") ?? "gallery");
  const url = String(formData.get("url") ?? "");

  try {
    await apiDelete("/api/v1/vendor/images", { kind, url });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Gambar gagal dihapus.";
    redirect(`/vendor/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePublic(vendor.id);
  redirect("/vendor/profile?ok=Gambar dihapus.");
}
