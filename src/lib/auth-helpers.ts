import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { roleHome, type Role } from "@/lib/roles";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: Role;
};

/** Dipakai oleh route handler: mengembalikan null alih-alih redirect. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user as SessionUser | undefined;
  return u?.id ? u : null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

/**
 * Guard server-side. Jika peran tidak sesuai, pengguna dikembalikan ke beranda
 * perannya sendiri (bukan selalu /dashboard) agar tidak terjadi redirect berantai
 * atau nyasar ke antarmuka peran lain.
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect(roleHome(u.role));
  return u;
}

export async function requireCustomer(): Promise<SessionUser> {
  return requireRole("CUSTOMER");
}
