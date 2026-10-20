"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiPost } from "@/lib/api";
import { getSessionUser } from "@/lib/auth-helpers";

/**
 * Kirim pesan pada penawaran. Hanya pelanggan & vendor pada penawaran tersebut.
 * Chat tidak pernah mengubah status penawaran.
 */
export async function sendOfferMessageAction(formData: FormData): Promise<never> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const quotationId = String(formData.get("quotationId") ?? "");
  if (!quotationId) redirect("/dashboard?error=Penawaran tidak ditemukan.");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) redirect(`/quotations/${quotationId}?error=Pesan tidak boleh kosong.`);

  try {
    await apiPost(`/api/v1/quotations/${quotationId}/messages`, { body });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Pesan gagal dikirim.";
    redirect(`/quotations/${quotationId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/quotations/${quotationId}`);
  redirect(`/quotations/${quotationId}#chat`);
}
