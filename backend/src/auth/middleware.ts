import type { NextFunction, Request, Response } from "express";
import { db } from "../db";
import { sendError } from "../http";
import { SESSION_COOKIE, verifySessionToken, type Role, type SessionUser } from "./jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/**
 * Membaca cookie sesi (tanpa menolak request); dipakai semua route.
 * Selain tanda tangan JWT, versi token & peran dicocokkan dengan database
 * sehingga ganti sandi (atau perubahan peran) langsung mencabut sesi lama.
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string" && token) {
      const session = await verifySessionToken(token);
      if (session) {
        const current = await db.user.findUnique({
          where: { id: session.id },
          select: { tokenVersion: true, role: true, isPlaceholder: true },
        });
        if (current && !current.isPlaceholder && current.tokenVersion === session.tokenVersion && current.role === session.role) {
          req.user = session;
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Silakan masuk terlebih dahulu.");
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Silakan masuk terlebih dahulu.");
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.");
    }
    next();
  };
}

/** Helper untuk handler: req.user dijamin ada setelah requireAuth. */
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new Error("currentUser dipanggil tanpa requireAuth");
  return req.user;
}
