/**
 * Matriks akses rute (dipakai middleware dan diuji unit).
 *
 *  - /vendor/*   → hanya VENDOR
 *  - /admin/*    → hanya ADMIN
 *  - /dashboard, /events/*, /profile → hanya CUSTOMER
 *  - /catering*  → tamu & CUSTOMER; vendor/admin dialihkan ke berandanya
 *  - /quotations/[id], /bookings/[id], /payments/[id] → cukup login;
 *    otorisasi per-resource ditegakkan di halaman & server action.
 */
export type RouteDecision = "allow" | "require-login" | "redirect-home";

const CUSTOMER_PREFIXES = ["/dashboard", "/events", "/profile"];
const SHARED_DETAIL_PREFIXES = ["/quotations/", "/bookings/", "/payments/"];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function decideRouteAccess(pathname: string, role?: string | null): RouteDecision {
  const logged = !!role;

  if (matches(pathname, "/vendor") || matches(pathname, "/admin")) {
    if (!logged) return "require-login";
    const required = matches(pathname, "/vendor") ? "VENDOR" : "ADMIN";
    return role === required ? "allow" : "redirect-home";
  }

  if (matches(pathname, "/catering")) {
    if (logged && role !== "CUSTOMER") return "redirect-home";
    return "allow";
  }

  if (CUSTOMER_PREFIXES.some((p) => matches(pathname, p))) {
    if (!logged) return "require-login";
    return role === "CUSTOMER" ? "allow" : "redirect-home";
  }

  if (SHARED_DETAIL_PREFIXES.some((p) => pathname.startsWith(p))) {
    return logged ? "allow" : "require-login";
  }

  return "allow";
}
