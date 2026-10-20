"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

const decisionSchema = z
  .object({
    id: z.string().min(1),
    // "verify" dipertahankan sebagai alias "approve" agar tombol lama tetap bekerja.
    decision: z.enum(["review", "approve", "verify", "request_info", "reject"], {
      errorMap: () => ({ message: "Keputusan verifikasi tidak valid." }),
    }),
    note: z.string().trim().max(1000, "Catatan maksimal 1000 karakter.").optional(),
  })
  .refine((v) => !["request_info", "reject"].includes(v.decision) || !!v.note, {
    message: "Catatan wajib diisi saat menolak atau meminta perbaikan.",
    path: ["note"],
  });

const STATUS_BY_DECISION = {
  review: "UNDER_REVIEW",
  approve: "VERIFIED",
  verify: "VERIFIED",
  request_info: "NEEDS_INFO",
  reject: "REJECTED",
} as const;

export async function verifyVendorAction(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = decisionSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    note: String(formData.get("note") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    redirect(`/admin/vendors?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data tidak valid.")}`);
  }

  const vendor = await db.vendorProfile.findUnique({ where: { id: parsed.data.id } });
  if (!vendor) redirect("/admin/vendors?error=Vendor tidak ditemukan.");

  const status = STATUS_BY_DECISION[parsed.data.decision];
  await db.vendorProfile.update({
    where: { id: vendor.id },
    data: {
      verificationStatus: status,
      verificationNote: parsed.data.note ?? null,
      reviewedAt: new Date(),
      reviewedById: admin.id,
    },
  });

  const messageByStatus: Record<string, string> = {
    UNDER_REVIEW: "Dokumen Anda sedang ditinjau admin.",
    VERIFIED: "Selamat! Verifikasi vendor Anda disetujui.",
    NEEDS_INFO: `Admin meminta perbaikan dokumen${parsed.data.note ? `: ${parsed.data.note}` : "."}`,
    REJECTED: `Verifikasi vendor ditolak${parsed.data.note ? `: ${parsed.data.note}` : "."}`,
  };
  await db.notification.create({
    data: {
      userId: vendor.userId,
      type: "VERIFICATION",
      title: "Status verifikasi diperbarui",
      message: messageByStatus[status] ?? "Status verifikasi diperbarui.",
    },
  });

  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${vendor.id}`);
  revalidatePath("/vendor/verification");
  redirect(`/admin/vendors/${vendor.id}?ok=Status verifikasi diperbarui.`);
}
