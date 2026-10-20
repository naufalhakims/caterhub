"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireVendor } from "@/server/vendor-helpers";
import {
  deletePrivateDocument,
  savePrivateDocument,
  validateUpload,
} from "@/server/storage";

const DOC_TYPES = ["BUSINESS_LICENSE", "PREMISES_PHOTO", "KITCHEN_PHOTO", "MENU_PACKAGE", "OTHER"] as const;

const uploadSchema = z.object({
  type: z.enum(DOC_TYPES, { errorMap: () => ({ message: "Jenis dokumen tidak valid." }) }),
  title: z.string().trim().max(120).optional(),
});

// Batas dokumen per vendor (mencegah penyalahgunaan penyimpanan).
const MAX_DOCUMENTS_PER_VENDOR = 20;

/** Unggah dokumen verifikasi. File privat — tidak pernah disajikan dari /public. */
export async function uploadVendorDocumentAction(formData: FormData) {
  const { vendor, user } = await requireVendor();
  const parsed = uploadSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    title: String(formData.get("title") ?? "") || undefined,
  });
  if (!parsed.success) {
    redirect(`/vendor/verification?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data tidak valid.")}`);
  }

  const count = await db.vendorDocument.count({ where: { vendorId: vendor.id } });
  if (count >= MAX_DOCUMENTS_PER_VENDOR) {
    redirect(`/vendor/verification?error=Maksimal ${MAX_DOCUMENTS_PER_VENDOR} dokumen. Hapus dokumen lama terlebih dahulu.`);
  }

  const imagesOnly = parsed.data.type === "PREMISES_PHOTO" || parsed.data.type === "KITCHEN_PHOTO";
  let upload = null as Awaited<ReturnType<typeof validateUpload>> | null;
  let uploadError: string | null = null;
  try {
    upload = await validateUpload(formData.get("file"), { imagesOnly });
  } catch (e) {
    uploadError = (e as Error).message;
  }
  if (!upload) {
    redirect(`/vendor/verification?error=${encodeURIComponent(uploadError ?? "File tidak valid.")}`);
  }

  const storageKey = await savePrivateDocument(vendor.id, upload);
  await db.vendorDocument.create({
    data: {
      vendorId: vendor.id,
      type: parsed.data.type,
      title: parsed.data.title,
      fileName: upload.originalName,
      storageKey,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      uploadedById: user.id,
    },
  });
  // Kirim ulang setelah ditolak / diminta perbaikan → masuk antrean tinjauan lagi.
  if (vendor.verificationStatus !== "VERIFIED" && vendor.verificationStatus !== "UNDER_REVIEW") {
    await db.vendorProfile.update({
      where: { id: vendor.id },
      data: { verificationStatus: "UNDER_REVIEW" },
    });
  }

  revalidatePath("/vendor/verification");
  revalidatePath("/admin/vendors");
  redirect("/vendor/verification?ok=Dokumen berhasil diunggah.");
}

export async function deleteVendorDocumentAction(formData: FormData) {
  const { vendor } = await requireVendor();
  const id = String(formData.get("id") ?? "");
  const doc = await db.vendorDocument.findUnique({ where: { id } });
  if (!doc || doc.vendorId !== vendor.id) {
    redirect("/vendor/verification?error=Akses ditolak.");
  }
  if (vendor.verificationStatus === "VERIFIED") {
    redirect("/vendor/verification?error=Dokumen tidak dapat diubah setelah vendor terverifikasi.");
  }

  await db.vendorDocument.delete({ where: { id: doc.id } });
  await deletePrivateDocument(doc.storageKey);
  revalidatePath("/vendor/verification");
  revalidatePath("/admin/vendors");
  redirect("/vendor/verification?ok=Dokumen dihapus.");
}
