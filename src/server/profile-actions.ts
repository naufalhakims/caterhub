"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth-helpers";

const PHONE_RE = /^[+]?[\d\s()-]{6,20}$/;

const profileSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80, "Nama maksimal 80 karakter."),
  phone: z
    .string()
    .trim()
    .max(20, "Nomor telepon maksimal 20 karakter.")
    .refine((v) => v === "" || PHONE_RE.test(v), "Nomor telepon tidak valid."),
  address: z.string().trim().max(200, "Alamat maksimal 200 karakter."),
  city: z.string().trim().max(60, "Kota maksimal 60 karakter."),
});

export async function updateCustomerProfileAction(formData: FormData) {
  // Hanya pelanggan; vendor/admin punya halaman profil masing-masing.
  const user = await requireCustomer();
  const parsed = profileSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
  });
  if (!parsed.success) {
    redirect(`/profile?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data profil tidak valid.")}`);
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
    },
  });
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/profile?ok=Profil berhasil disimpan.");
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi."),
    newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi wajib diisi."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Kata sandi baru harus berbeda dari yang lama.",
    path: ["newPassword"],
  });

export async function changePasswordAction(formData: FormData) {
  const user = await requireCustomer();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) {
    redirect(`/profile?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data tidak valid.")}`);
  }

  const record = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!record?.passwordHash) redirect("/profile?error=Akun ini tidak memakai kata sandi.");
  const ok = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
  if (!ok) redirect("/profile?error=Kata sandi saat ini salah.");

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  redirect("/profile?ok=Kata sandi berhasil diubah.");
}
