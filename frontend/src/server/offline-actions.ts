"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiPost } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import { parseIDR } from "@/lib/money";

function refresh() {
  revalidatePath("/vendor/orders");
  revalidatePath("/vendor/production");
  revalidatePath("/vendor/calendar");
  revalidatePath("/vendor/capacity");
  revalidatePath("/vendor/dashboard");
}

/** Vendor mencatat pesanan dari WhatsApp/telepon agar kapasitas & produksi akurat. */
export async function createOfflineOrderAction(formData: FormData): Promise<never> {
  await requireVendor();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  let bookingId: string;
  try {
    const result = await apiPost<{ bookingId: string }>("/api/v1/vendor/bookings/offline", {
      customerName: str("customerName"),
      customerPhone: str("customerPhone") || undefined,
      eventName: str("eventName"),
      eventDate: str("eventDate"),
      eventTime: str("eventTime"),
      guestCount: Number(formData.get("guestCount")),
      location: str("location"),
      city: str("city") || "Surabaya",
      packageId: str("packageId"),
      addOnIds: formData.getAll("addOnIds").map(String).filter(Boolean),
      deliveryFee: parseIDR(formData.get("deliveryFee")) ?? 0,
      serviceFee: parseIDR(formData.get("serviceFee")) ?? 0,
      discount: parseIDR(formData.get("discount")) ?? 0,
      notes: str("notes") || undefined,
      payment: str("payment") || "NONE",
    });
    bookingId = result.bookingId;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Pesanan offline gagal dicatat.";
    redirect(`/vendor/orders/new?error=${encodeURIComponent(message)}`);
  }
  refresh();
  redirect(`/bookings/${bookingId}?ok=${encodeURIComponent("Pesanan offline dicatat. Kapasitas dan lembar produksi sudah diperbarui.")}`);
}

/** Catat pelunasan tunai/transfer untuk pesanan offline. */
export async function recordManualPaymentAction(formData: FormData): Promise<never> {
  await requireVendor();
  const id = String(formData.get("bookingId") ?? "");
  const back = String(formData.get("returnTo") ?? "") === "booking" ? `/bookings/${id}` : "/vendor/orders";
  try {
    await apiPost(`/api/v1/vendor/bookings/${id}/manual-payment`, { method: String(formData.get("method") ?? "CASH") });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Pembayaran gagal dicatat.";
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }
  refresh();
  revalidatePath(`/bookings/${id}`);
  redirect(`${back}?ok=${encodeURIComponent("Pelunasan dicatat. Pesanan kini berstatus lunas.")}`);
}
