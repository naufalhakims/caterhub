"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiDelete, apiForm } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";

/** Unggah dokumen verifikasi. File privat — API yang menyimpan, frontend hanya meneruskan. */
export async function uploadVendorDocumentAction(formData: FormData): Promise<never> {
  await requireVendor();
  try {
    await apiForm("/api/v1/vendor/documents", formData);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "File tidak valid.";
    redirect(`/vendor/verification?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/vendor/verification");
  revalidatePath("/admin/vendors");
  redirect("/vendor/verification?ok=Dokumen berhasil diunggah.");
}

export async function deleteVendorDocumentAction(formData: FormData): Promise<never> {
  await requireVendor();
  const id = String(formData.get("id") ?? "");
  try {
    await apiDelete(`/api/v1/vendor/documents/${id}`);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Dokumen gagal dihapus.";
    redirect(`/vendor/verification?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/vendor/verification");
  revalidatePath("/admin/vendors");
  redirect("/vendor/verification?ok=Dokumen dihapus.");
}
