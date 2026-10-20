"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiPatch } from "@/lib/api";
import { requireRole } from "@/lib/auth-helpers";

const DECISIONS = ["review", "approve", "verify", "request_info", "reject"] as const;

export async function verifyVendorAction(formData: FormData): Promise<never> {
  await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!id || !DECISIONS.includes(decision as (typeof DECISIONS)[number])) {
    redirect(`/admin/vendors?error=${encodeURIComponent("Keputusan verifikasi tidak valid.")}`);
  }
  if (["request_info", "reject"].includes(decision) && !note) {
    redirect(`/admin/vendors/${id}?error=${encodeURIComponent("Catatan wajib diisi saat menolak atau meminta perbaikan.")}`);
  }

  try {
    await apiPatch(`/api/v1/admin/vendors/${id}/verification`, {
      decision,
      note: note || undefined,
    });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Status verifikasi gagal diperbarui.";
    redirect(`/admin/vendors/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${id}`);
  revalidatePath("/vendor/verification");
  redirect(`/admin/vendors/${id}?ok=Status verifikasi diperbarui.`);
}
