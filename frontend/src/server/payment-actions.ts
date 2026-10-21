"use server";

import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import { requireCustomer } from "@/lib/auth-helpers";

/** Buat satu pembayaran lunas untuk pesanan yang sudah dikonfirmasi vendor. */
export async function createPaymentAction(formData: FormData): Promise<never> {
  await requireCustomer();

  const bookingId = String(formData.get("bookingId") ?? "");

  let payment: { id: string };
  try {
    payment = await apiPost<{ id: string }>("/api/v1/payments", { bookingId, kind: "full" });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Pembayaran gagal dibuat.";
    redirect(`/bookings/${bookingId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/payments/${payment.id}`);
}
