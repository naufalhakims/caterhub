"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiPost } from "@/lib/api";
import { requireCustomer, requireRole } from "@/lib/auth-helpers";

export async function createBookingReviewAction(formData: FormData): Promise<never> {
  await requireCustomer();

  const bookingId = String(formData.get("bookingId") ?? "");
  const vendorId = String(formData.get("vendorId") ?? "");
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();

  if (!bookingId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`/bookings/${bookingId}?error=${encodeURIComponent("Pilih rating 1–5 bintang.")}`);
  }

  try {
    await apiPost(`/api/v1/bookings/${bookingId}/review`, {
      rating,
      comment: comment || undefined,
    });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Ulasan gagal dikirim.";
    redirect(`/bookings/${bookingId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/dashboard");
  revalidatePath("/catering");
  if (vendorId) revalidatePath(`/catering/${vendorId}`);
  redirect(`/bookings/${bookingId}?ok=Terima kasih! Ulasan Anda sudah tersimpan.`);
}

/** Hanya izinkan kembali ke rute internal (cegah open redirect). */
function safeReturn(value: FormDataEntryValue | null, fallback: string): string {
  const to = String(value ?? "");
  return to.startsWith("/") && !to.startsWith("//") ? to : fallback;
}

/** Pembatalan oleh pelanggan atau vendor; kebijakan & refund ditegakkan API. */
export async function cancelBookingAction(formData: FormData): Promise<never> {
  const user = await requireRole("CUSTOMER", "VENDOR");
  const bookingId = String(formData.get("bookingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const back = safeReturn(
    formData.get("returnTo"),
    user.role === "VENDOR" ? "/vendor/orders" : `/bookings/${bookingId}`,
  );

  let status = "CANCELLED";
  try {
    const result = await apiPost<{ status: string }>(`/api/v1/bookings/${bookingId}/cancel`, { reason });
    status = result.status;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Pesanan gagal dibatalkan.";
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/vendor/orders");
  revalidatePath("/vendor/capacity");
  revalidatePath("/dashboard");
  const ok =
    status === "REFUND_PENDING"
      ? "Pesanan dibatalkan. Refund diteruskan ke admin untuk diproses."
      : "Pesanan dibatalkan dan jadwal vendor dilepas.";
  redirect(`${back}?ok=${encodeURIComponent(ok)}`);
}

/** Pelanggan mengonfirmasi makanan sudah diterima → pesanan selesai. */
export async function confirmReceiptAction(formData: FormData): Promise<never> {
  await requireCustomer();
  const bookingId = String(formData.get("bookingId") ?? "");
  try {
    await apiPost(`/api/v1/bookings/${bookingId}/received`);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Konfirmasi gagal disimpan.";
    redirect(`/bookings/${bookingId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/dashboard");
  revalidatePath("/vendor/orders");
  redirect(`/bookings/${bookingId}?ok=${encodeURIComponent("Terima kasih! Pesanan selesai — silakan beri ulasan untuk vendor.")}`);
}
