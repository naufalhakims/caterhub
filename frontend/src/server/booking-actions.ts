"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiPost } from "@/lib/api";
import { requireCustomer } from "@/lib/auth-helpers";

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
