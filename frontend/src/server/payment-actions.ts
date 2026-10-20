"use server";

import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import { requireCustomer } from "@/lib/auth-helpers";

/** Buat pembayaran untuk booking milik customer. Deposit default 50%. */
export async function createPaymentAction(formData: FormData): Promise<never> {
  await requireCustomer();

  const bookingId = String(formData.get("bookingId") ?? "");
  const kind = String(formData.get("kind") ?? "deposit");

  let payment: { id: string };
  try {
    payment = await apiPost<{ id: string }>("/api/v1/payments", { bookingId, kind });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Pembayaran gagal dibuat.";
    redirect(`/bookings/${bookingId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/payments/${payment.id}`);
}
