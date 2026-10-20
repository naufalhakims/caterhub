"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations";
import { roleHome } from "@/lib/roles";
import { signIn } from "@/auth";

function fail(to: string, msg: string): never {
  redirect(`${to}?error=${encodeURIComponent(msg)}`);
}

function normalizeEmail(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().toLowerCase();
}

export async function registerAction(formData: FormData): Promise<never> {
  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: normalizeEmail(formData.get("email")),
    password: formData.get("password"),
    // Peran hanya CUSTOMER/VENDOR — ADMIN tidak bisa didaftarkan lewat form publik.
    role: formData.get("role") ?? "CUSTOMER",
  });
  if (!parsed.success) {
    fail("/register", parsed.error.issues[0]?.message ?? "Data tidak valid.");
  }
  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) fail("/register", "Email sudah terdaftar. Silakan masuk.");

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
  });
  if (parsed.data.role === "VENDOR") {
    await db.vendorProfile.create({
      data: {
        userId: user.id,
        businessName: parsed.data.name,
        city: "Surabaya",
        minPax: 50,
        maxPax: 500,
      },
    });
  }
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) fail("/login", "Pendaftaran berhasil. Silakan masuk.");
    throw e;
  }
  redirect(parsed.data.role === "VENDOR" ? "/vendor/profile" : "/dashboard");
}

export async function loginAction(formData: FormData): Promise<never> {
  const email = normalizeEmail(formData.get("email"));
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) fail("/login", "Email atau kata sandi salah.");
    throw e;
  }
  const u = await db.user.findUnique({ where: { email }, select: { role: true } });
  redirect(roleHome(u?.role));
}
