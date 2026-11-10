import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/jwt";
import { roleHome } from "@/lib/roles";
import { decideRouteAccess } from "@/lib/route-access";
import { middlewareRedirect } from "@/lib/redirect";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;
  const role = user?.role;

  const decision = decideRouteAccess(req.nextUrl.pathname, role);
  if (decision === "require-login") {
    return middlewareRedirect(req, "/login", { next: req.nextUrl.pathname });
  }
  if (decision === "redirect-home") {
    return middlewareRedirect(req, roleHome(role));
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
    "/notifications",
  ],
};
