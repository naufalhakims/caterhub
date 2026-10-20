import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/jwt";
import { roleHome } from "@/lib/roles";
import { decideRouteAccess } from "@/lib/route-access";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;
  const role = user?.role;

  const decision = decideRouteAccess(req.nextUrl.pathname, role);
  if (decision === "require-login") {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (decision === "redirect-home") {
    return NextResponse.redirect(new URL(roleHome(role), req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/events/:path*",
    "/profile",
    "/catering/:path*",
    "/quotations/:path*",
    "/bookings/:path*",
    "/payments/:path*",
    "/vendor/:path*",
    "/admin/:path*",
  ],
};
