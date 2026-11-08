import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";

export const SESSION_COOKIE = "caterhub_session";
/** 7 hari — lebih pendek dari sebelumnya (30 hari) agar sesi curian cepat basi. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type Role = "CUSTOMER" | "VENDOR" | "ADMIN";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  /** Harus sama dengan User.tokenVersion; naik saat ganti sandi → sesi lama ditolak. */
  tokenVersion: number;
};

const secret = () => new TextEncoder().encode(env.authSecret);

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ role: user.role, email: user.email, name: user.name, tv: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (!payload.sub || (role !== "CUSTOMER" && role !== "VENDOR" && role !== "ADMIN")) return null;
    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : null,
      role,
      tokenVersion: typeof payload.tv === "number" ? payload.tv : 0,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProduction,
    path: "/",
    // Express mengharapkan milidetik; konstanta TTL dalam detik.
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}
