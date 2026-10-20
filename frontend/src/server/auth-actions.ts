"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/api";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/jwt";
import { roleHome } from "@/lib/roles";

function normalizeEmail(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().toLowerCase();
}

function fail(to: string, msg: string): never {
  redirect(`${to}?error=${encodeURIComponent(msg)}`);
}

/** Ambil nilai cookie sesi dari header Set-Cookie API. */
function sessionFromSetCookie(header: string | null): string | null {
  if (!header) return null;
  const pair = header.split(";")[0] ?? "";
  const eq = pair.indexOf("=");
  if (eq < 0) return null;
  const value = pair.slice(eq + 1).trim();
  return value || null;
}

async function authRequest(path: "/auth/login" | "/auth/register", body: Record<string, unknown>) {
  const res = await fetch(`${apiBaseUrl()}/api/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => null)) as
    | { data?: { user?: { role?: string } }; error?: { message?: string } }
    | null;
  return { res, payload };
}

export async function loginAction(formData: FormData): Promise<never> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  let result: Awaited<ReturnType<typeof authRequest>>;
  try {
    result = await authRequest("/auth/login", { email, password });
  } catch {
    fail("/login", "Layanan masuk tidak tersedia. Coba lagi.");
  }
  if (!result.res.ok) fail("/login", result.payload?.error?.message ?? "Email atau kata sandi salah.");

  const token = sessionFromSetCookie(result.res.headers.get("set-cookie"));
  if (!token) fail("/login", "Sesi gagal dibuat. Coba lagi.");
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(roleHome(result.payload?.data?.user?.role));
}

export async function registerAction(formData: FormData): Promise<never> {
  const body = {
    name: String(formData.get("name") ?? "").trim(),
    email: normalizeEmail(formData.get("email")),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "CUSTOMER"),
  };

  let result: Awaited<ReturnType<typeof authRequest>>;
  try {
    result = await authRequest("/auth/register", body);
  } catch {
    fail("/register", "Layanan pendaftaran tidak tersedia. Coba lagi.");
  }
  if (!result.res.ok) fail("/register", result.payload?.error?.message ?? "Pendaftaran gagal.");

  const token = sessionFromSetCookie(result.res.headers.get("set-cookie"));
  if (!token) fail("/login", "Pendaftaran berhasil. Silakan masuk.");
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(body.role === "VENDOR" ? "/vendor/profile" : "/dashboard");
}

export async function logoutAction(): Promise<never> {
  try {
    await fetch(`${apiBaseUrl()}/api/v1/auth/logout`, {
      method: "POST",
      headers: { cookie: cookies().toString() },
      cache: "no-store",
    });
  } catch {
    // Cookie lokal tetap dihapus walau API tidak terjangkau.
  }
  cookies().delete(SESSION_COOKIE);
  redirect("/");
}
