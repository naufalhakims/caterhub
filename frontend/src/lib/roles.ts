export type Role = "CUSTOMER" | "VENDOR" | "ADMIN";

export const ROLES: readonly Role[] = ["CUSTOMER", "VENDOR", "ADMIN"] as const;

/** Halaman beranda untuk tiap peran — dipakai untuk redirect & back-navigation. */
export function roleHome(role?: string | null): string {
  if (role === "VENDOR") return "/vendor/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/dashboard";
}

export function isRole(role: string | null | undefined, ...allowed: Role[]): boolean {
  return !!role && allowed.includes(role as Role);
}
