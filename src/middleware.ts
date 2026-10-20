import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { roleHome } from "@/lib/roles";
import { decideRouteAccess } from "@/lib/route-access";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as { role?: string } | undefined;
  const role = user?.role;

  const decision = decideRouteAccess(pathname, role);
  if (decision === "require-login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (decision === "redirect-home") {
    return NextResponse.redirect(new URL(roleHome(role), req.url));
  }
  return NextResponse.next();
});

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
