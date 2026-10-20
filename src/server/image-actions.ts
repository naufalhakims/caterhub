"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireVendor } from "@/server/vendor-helpers";
import { deletePublicImage, savePublicImage, validateUpload } from "@/server/storage";

const MAX_GALLERY = 8;

async function readImage(formData: FormData) {
  let upload = null as Awaited<ReturnType<typeof validateUpload>> | null;
  let error: string | null = null;
  try {
    upload = await validateUpload(formData.get("image"), { imagesOnly: true });
  } catch (e) {
    error = (e as Error).message;
  }
  return { upload, error };
}

function revalidatePublic() {
  revalidatePath("/vendor/profile");
  revalidatePath("/catering");
  revalidatePath("/");
}

/** Unggah logo, cover, atau foto galeri. File lama dihapus saat diganti. */
export async function uploadVendorImageAction(formData: FormData) {
  const { vendor } = await requireVendor();
  const kind = String(formData.get("kind") ?? "");
  if (!["logo", "cover", "gallery"].includes(kind)) {
    redirect("/vendor/profile?error=Jenis gambar tidak valid.");
  }

  const { upload, error } = await readImage(formData);
  if (!upload) redirect(`/vendor/profile?error=${encodeURIComponent(error ?? "Gambar tidak valid.")}`);

  const url = await savePublicImage(`vendors/${vendor.id}`, upload);

  if (kind === "logo") {
    const old = vendor.logoUrl;
    await db.vendorProfile.update({ where: { id: vendor.id }, data: { logoUrl: url } });
    await deletePublicImage(old);
  } else if (kind === "cover") {
    const old = vendor.coverUrl;
    await db.vendorProfile.update({ where: { id: vendor.id }, data: { coverUrl: url } });
    await deletePublicImage(old);
  } else {
    if (vendor.gallery.length >= MAX_GALLERY) {
      await deletePublicImage(url);
      redirect(`/vendor/profile?error=Maksimal ${MAX_GALLERY} foto galeri.`);
    }
    await db.vendorProfile.update({
      where: { id: vendor.id },
      data: { gallery: { push: url } },
    });
  }

  revalidatePublic();
  revalidatePath(`/catering/${vendor.id}`);
  redirect("/vendor/profile?ok=Gambar berhasil diunggah.");
}

export async function removeVendorImageAction(formData: FormData) {
  const { vendor } = await requireVendor();
  const kind = String(formData.get("kind") ?? "gallery");
  const url = String(formData.get("url") ?? "");

  if (kind === "logo" && vendor.logoUrl === url) {
    await db.vendorProfile.update({ where: { id: vendor.id }, data: { logoUrl: null } });
    await deletePublicImage(url);
  } else if (kind === "cover" && vendor.coverUrl === url) {
    await db.vendorProfile.update({ where: { id: vendor.id }, data: { coverUrl: null } });
    await deletePublicImage(url);
  } else if (kind === "gallery" && vendor.gallery.includes(url)) {
    await db.vendorProfile.update({
      where: { id: vendor.id },
      data: { gallery: vendor.gallery.filter((g) => g !== url) },
    });
    await deletePublicImage(url);
  } else {
    redirect("/vendor/profile?error=Gambar tidak ditemukan.");
  }

  revalidatePublic();
  revalidatePath(`/catering/${vendor.id}`);
  redirect("/vendor/profile?ok=Gambar dihapus.");
}
