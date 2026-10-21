"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/auth-helpers";
import { parseIDR } from "@/lib/money";

/** Vendor mengonfirmasi permintaan pesanan dan menetapkan biaya tambahan nota. */
export async function confirmQuotationRequestAction(formData: FormData): Promise<never> {
  await requireRole("VENDOR");

  const quotationId = String(formData.get("quotationId") ?? "");
  if (!quotationId) redirect("/vendor/quotations?error=Permintaan tidak ditemukan.");

  try {
    await apiPost<{ bookingId: string }>(`/api/v1/quotations/${quotationId}/confirm`, {
      deliveryFee: parseIDR(formData.get("deliveryFee")) ?? 0,
      serviceFee: parseIDR(formData.get("serviceFee")) ?? 0,
      discount: parseIDR(formData.get("discount")) ?? 0,
    });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Permintaan gagal dikonfirmasi.";
    redirect(`/vendor/quotations?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/vendor/quotations");
  revalidatePath("/vendor/orders");
  revalidatePath("/dashboard");
  revalidatePath(`/quotations/${quotationId}`);
  redirect("/vendor/orders?ok=Pesanan dikonfirmasi. Pelanggan sekarang dapat membayar lunas.");
}

/** Vendor menolak permintaan pelanggan. */
export async function declineQuotationRequestAction(formData: FormData): Promise<never> {
  await requireRole("VENDOR");

  const quotationId = String(formData.get("quotationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!quotationId) redirect("/vendor/quotations?error=Permintaan tidak ditemukan.");

  try {
    await apiPost(`/api/v1/quotations/${quotationId}/decline`, { reason });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Permintaan gagal ditolak.";
    redirect(`/vendor/quotations?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/vendor/quotations");
  revalidatePath("/dashboard");
  revalidatePath(`/quotations/${quotationId}`);
  redirect("/vendor/quotations?ok=Permintaan ditolak.");
}
