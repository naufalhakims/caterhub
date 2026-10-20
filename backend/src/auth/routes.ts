import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { asyncHandler, sendError } from "../http";
import { requireAuth } from "./middleware";
import { SESSION_COOKIE, sessionCookieOptions, signSession, type SessionUser } from "./jwt";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter."),
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  password: z.string().min(6, "Kata sandi minimal 6 karakter."),
  role: z.enum(["CUSTOMER", "VENDOR"]).default("CUSTOMER"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Kata sandi lama wajib diisi."),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
});

function toSessionUser(u: { id: string; email: string; name: string | null; role: string }): SessionUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role as SessionUser["role"] };
}

export function authRouter() {
  const router = Router();

  router.post(
    "/register",
    asyncHandler(async (req, res) => {
      const input = registerSchema.parse(req.body ?? {});
      const exists = await db.user.findUnique({ where: { email: input.email } });
      if (exists) return sendError(res, 409, "EMAIL_TAKEN", "Email sudah terdaftar. Silakan masuk.");

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await db.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
        },
      });
      if (input.role === "VENDOR") {
        await db.vendorProfile.create({
          data: {
            userId: user.id,
            businessName: input.name,
            city: "Surabaya",
            minPax: 50,
            maxPax: 500,
          },
        });
      }

      const session = toSessionUser(user);
      const token = await signSession(session);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
      res.status(201).json({ data: { user: session } });
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const input = loginSchema.parse(req.body ?? {});
      const user = await db.user.findUnique({ where: { email: input.email } });
      // Pesan generik: jangan bocorkan apakah email terdaftar.
      if (!user?.passwordHash) {
        return sendError(res, 401, "INVALID_CREDENTIALS", "Email atau kata sandi salah.");
      }
      const ok = await bcrypt.compare(input.password, user.passwordHash);
      if (!ok) return sendError(res, 401, "INVALID_CREDENTIALS", "Email atau kata sandi salah.");

      const session = toSessionUser(user);
      const token = await signSession(session);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
      res.json({ data: { user: session } });
    }),
  );

  router.post("/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.status(204).end();
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json({ data: { user: req.user } });
  });

  router.patch(
    "/password",
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = passwordSchema.parse(req.body ?? {});
      const user = await db.user.findUnique({ where: { id: req.user!.id } });
      if (!user?.passwordHash) {
        return sendError(res, 400, "NO_PASSWORD", "Akun ini tidak memakai kata sandi.");
      }
      const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!ok) return sendError(res, 400, "WRONG_PASSWORD", "Kata sandi lama salah.");
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(input.newPassword, 10) },
      });
      res.json({ data: { ok: true } });
    }),
  );

  // Info non-sensitif untuk health/debug; tidak dipakai frontend.
  router.get("/config", (_req, res) => {
    res.json({ data: { provider: env.paymentProvider } });
  });

  return router;
}
