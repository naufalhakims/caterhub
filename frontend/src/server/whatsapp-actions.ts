"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiPatch } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";

function safeReturn(value: FormDataEntryValue | null): string {
  const to = String(value ?? "");
  return to.startsWith("/") && !to.startsWith("//") ? to : "/profile";
}

/** Aktif/nonaktifkan notifikasi WhatsApp untuk akun yang sedang masuk. */
export async function setWhatsAppOptInAction(formData: FormData): Promise<never> {
  await requireUser();
  const optIn = String(formData.get("optIn")) === "true";
  const back = safeReturn(formData.get("returnTo"));
  try {
    await apiPatch("/api/v1/me/whatsapp", { optIn });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Pengaturan gagal disimpan.";
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(back);
  redirect(`${back}?ok=${encodeURIComponent(optIn ? "Notifikasi WhatsApp diaktifkan." : "Notifikasi WhatsApp dimatikan.")}`);
}
