import { jwtVerify } from "jose";

export const SESSION_COOKIE = "caterhub_session";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export type Role = "CUSTOMER" | "VENDOR" | "ADMIN";
export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

// Harus sama dengan backend (dev fallback). Produksi wajib set AUTH_SECRET.
const DEV_SECRET = "dev-only-insecure-secret-change-me-please-32";

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET || DEV_SECRET);
}

/** Dipakai middleware (Edge) dan server components. */
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
    };
  } catch {
    return null;
  }
}
