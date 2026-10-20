"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/auth-helpers";
import { parseIDR } from "@/lib/money";

function parseItems(formData: FormData): { name: string; quantity: number; unitPrice: number }[] {
  const rawItems = String(formData.get("itemsJson") ?? "");
  if (rawItems) {
    try {
      const parsed = JSON.parse(rawItems) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((row) => {
            const r = row as Record<string, unknown>;
            return {
              name: String(r.name ?? ""),
              quantity: Number(r.quantity ?? 0),
              unitPrice: parseIDR(r.unitPrice) ?? 0,
            };
          })
        : [];
    } catch {
      return [];
    }
  }

  const rows: { name: string; quantity: number; unitPrice: number }[] = [];
  for (let i = 0; i < 50; i++) {
    const name = formData.get(`itemName${i}`);
    if (name == null) break;
    rows.push({
      name: String(name),
      quantity: Number(formData.get(`itemQty${i}`) ?? 0),
      unitPrice: parseIDR(formData.get(`itemPrice${i}`)) ?? 0,
    });
  }
  return rows;
}

/** Vendor mengirim penawaran baru atau revisi. */
export async function sendQuotationAction(formData: FormData): Promise<never> {
  await requireRole("VENDOR");

  const quotationId = String(formData.get("quotationId") ?? "");
  const body = {
    ...(quotationId ? { quotationId } : {}),
    eventId: String(formData.get("eventId") ?? ""),
    customerId: String(formData.get("customerId") ?? ""),
    packageId: String(formData.get("packageId") ?? "") || undefined,
    items: parseItems(formData),
    deliveryFee: parseIDR(formData.get("deliveryFee")) ?? 0,
    serviceFee: parseIDR(formData.get("serviceFee")) ?? 0,
    discount: parseIDR(formData.get("discount")) ?? 0,
    notes: String(formData.get("notes") ?? "") || undefined,
    expiresAt: String(formData.get("expiresAt") ?? "") || undefined,
  };

  let result: { id: string };
  try {
    result = await apiPost<{ id: string }>("/api/v1/quotations", body);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Data penawaran tidak valid.";
    redirect(`/vendor/quotations?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/vendor/quotations");
  revalidatePath("/dashboard");
  revalidatePath(`/quotations/${result.id}`);
  redirect(`/quotations/${result.id}`);
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
  redirect("/vendor/quotations?ok=Permintaan ditolak.");
}

/** Pelanggan menerima / menolak / meminta revisi. */
export async function quotationDecisionAction(formData: FormData): Promise<never> {
  await requireRole("CUSTOMER");

  const quotationId = String(formData.get("quotationId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const revisionNote = String(formData.get("revisionNote") ?? "").trim();

  if (!quotationId || !["accept", "reject", "revision"].includes(decision)) {
    redirect("/dashboard?error=Keputusan tidak valid.");
  }
  if (decision === "revision" && !revisionNote) {
    redirect(`/quotations/${quotationId}?error=${encodeURIComponent("Catatan revisi wajib diisi.")}`);
  }

  let bookingId: string | null = null;
  try {
    const result = await apiPost<{ bookingId?: string }>(
      `/api/v1/quotations/${quotationId}/decision`,
      { decision, revisionNote: revisionNote || undefined },
    );
    bookingId = result.bookingId ?? null;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Keputusan gagal diproses.";
    redirect(`/quotations/${quotationId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/dashboard");
  if (bookingId) redirect(`/bookings/${bookingId}`);
  redirect(`/quotations/${quotationId}?ok=Penawaran diperbarui.`);
}
