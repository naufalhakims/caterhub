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

const VALID_DAYS = new Set([1, 3, 7]);

/** Vendor mengirim/merevisi penawaran khusus (item & harga bisa diubah). */
export async function sendOfferAction(formData: FormData): Promise<never> {
  await requireRole("VENDOR");

  const quotationId = String(formData.get("quotationId") ?? "");
  const back = `/quotations/${quotationId}`;
  const names = formData.getAll("itemName").map((v) => String(v).trim());
  const qtys = formData.getAll("itemQty").map((v) => Number(v));
  const prices = formData.getAll("itemPrice").map((v) => parseIDR(v) ?? 0);
  const menuIds = formData.getAll("itemMenuId").map((v) => String(v));
  const items = names
    .map((name, i) => ({
      name,
      quantity: Math.trunc(qtys[i] ?? 0),
      unitPrice: prices[i] ?? 0,
      ...(menuIds[i] ? { menuItemId: menuIds[i] } : {}),
    }))
    .filter((i) => i.name);
  if (items.length === 0 || items.some((i) => i.quantity < 1)) {
    redirect(`${back}?error=${encodeURIComponent("Isi minimal satu item dengan jumlah ≥ 1.")}`);
  }
  const days = Number(formData.get("validDays"));
  const validDays = VALID_DAYS.has(days) ? days : 3;

  try {
    await apiPost("/api/v1/quotations", {
      quotationId,
      eventId: String(formData.get("eventId") ?? ""),
      customerId: String(formData.get("customerId") ?? ""),
      packageId: String(formData.get("packageId") ?? "") || undefined,
      items,
      deliveryFee: parseIDR(formData.get("deliveryFee")) ?? 0,
      serviceFee: parseIDR(formData.get("serviceFee")) ?? 0,
      discount: parseIDR(formData.get("discount")) ?? 0,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      expiresAt: new Date(Date.now() + validDays * 86_400_000).toISOString(),
    });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Penawaran gagal dikirim.";
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(back);
  revalidatePath("/vendor/quotations");
  revalidatePath("/dashboard");
  redirect(`${back}?ok=${encodeURIComponent("Penawaran terkirim. Pelanggan akan menerima notifikasi.")}`);
}

/** Pelanggan menerima, menolak, atau meminta revisi penawaran vendor. */
export async function decideOfferAction(formData: FormData): Promise<never> {
  await requireRole("CUSTOMER");

  const quotationId = String(formData.get("quotationId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  const back = `/quotations/${quotationId}`;
  if (!["accept", "reject", "revision"].includes(decision)) {
    redirect(`${back}?error=${encodeURIComponent("Keputusan tidak valid.")}`);
  }

  let bookingId: string | undefined;
  try {
    const result = await apiPost<{ bookingId?: string }>(`/api/v1/quotations/${quotationId}/decision`, {
      decision,
      revisionNote: note || undefined,
    });
    bookingId = result.bookingId;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Keputusan gagal disimpan.";
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(back);
  revalidatePath("/dashboard");
  revalidatePath("/vendor/quotations");
  if (decision === "accept" && bookingId) {
    redirect(`/bookings/${bookingId}?ok=${encodeURIComponent("Penawaran diterima. Silakan bayar lunas sebelum batas waktu.")}`);
  }
  redirect(
    `${back}?ok=${encodeURIComponent(
      decision === "revision" ? "Permintaan revisi dikirim ke vendor." : "Penawaran ditolak.",
    )}`,
  );
}
