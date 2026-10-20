import { Router } from "express";
import { authRouter } from "./auth/routes";
import { attachUser } from "./auth/middleware";
import { eventsRouter } from "./modules/events";
import { quotationsRouter } from "./modules/quotations";
import { vendorRouter, documentsRouter } from "./modules/vendor";
import { profileRouter } from "./modules/profile";
import { adminRouter, bookingsRouter } from "./modules/admin";
import { paymentsRouter } from "./modules/payments";
import { publicRouter } from "./modules/public";
import { viewsRouter } from "./modules/views";

/** Router gabungan seluruh modul API. */
export function createApiRouter(): Router {
  const api = Router();
  // Semua route API butuh konteks user (opsional); requireAuth/requireRole menolak.
  api.use(attachUser);
  api.use("/auth", authRouter());
  api.use("/events", eventsRouter());
  api.use("/quotations", quotationsRouter());
  api.use("/vendor", vendorRouter());
  api.use("/documents", documentsRouter());
  api.use("/me", profileRouter());
  api.use("/admin", adminRouter());
  api.use("/bookings", bookingsRouter());
  api.use("/payments", paymentsRouter());
  // Router publik dipasang sebelum router agregat agar tidak tertutup path lain.
  api.use("/", publicRouter());
  api.use("/", viewsRouter());
  return api;
}
