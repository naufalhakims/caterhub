"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiPatch } from "@/lib/api";
import { requireCustomer } from "@/lib/auth-helpers";

export async function updateCustomerProfileAction(formData: FormData): Promise<never> {
  await requireCustomer();

  try {
    await apiPatch("/api/v1/me", {
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
    });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Data profil tidak valid.";
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/profile?ok=Profil berhasil disimpan.");
}

export async function changePasswordAction(formData: FormData): Promise<never> {
  await requireCustomer();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    redirect(`/profile?error=${encodeURIComponent("Kata sandi baru minimal 8 karakter.")}`);
  }
  if (newPassword !== confirmPassword) {
    redirect(`/profile?error=${encodeURIComponent("Konfirmasi kata sandi tidak cocok.")}`);
  }
  if (newPassword === currentPassword) {
    redirect(`/profile?error=${encodeURIComponent("Kata sandi baru harus berbeda dari yang lama.")}`);
  }

  try {
    await apiPatch("/api/v1/auth/password", { currentPassword, newPassword });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Kata sandi gagal diubah.";
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  redirect("/profile?ok=Kata sandi berhasil diubah.");
}
