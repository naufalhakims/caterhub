"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";

function internalLink(value: FormDataEntryValue | null): string | null {
  const to = String(value ?? "");
  return to.startsWith("/") && !to.startsWith("//") ? to : null;
}

/** Buka notifikasi: tandai dibaca lalu menuju halaman terkait. */
export async function openNotificationAction(formData: FormData): Promise<never> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) {
    try {
      await apiPost("/api/v1/me/notifications/read", { ids: [id] });
    } catch {
      // Gagal menandai bukan alasan untuk menahan navigasi.
    }
  }
  revalidatePath("/notifications");
  redirect(internalLink(formData.get("link")) ?? "/notifications");
}

export async function markAllNotificationsReadAction(): Promise<never> {
  await requireUser();
  try {
    await apiPost("/api/v1/me/notifications/read", {});
  } catch {
    redirect("/notifications?error=Gagal menandai notifikasi.");
  }
  revalidatePath("/notifications");
  redirect("/notifications?ok=Semua notifikasi ditandai sudah dibaca.");
}
