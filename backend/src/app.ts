import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Router } from "express";
import { errorHandler, notFoundHandler } from "./http";
import type { VendorRepository } from "./vendors/dto";
import { vendorsRouter } from "./vendors/routes";

export type AppDeps = {
  vendors: VendorRepository;
  /** Router gabungan modul non-katalog (auth, event, penawaran, dst.). */
  api?: Router;
  corsOrigins?: string[];
  publicUploadDir?: string;
};

/**
 * Factory app agar bisa diuji tanpa database (repository & router di-inject).
 * Semua respons memakai envelope { data } / { error: { code, message, fields? } }.
 */
export function createApp({
  vendors,
  api,
  corsOrigins = ["http://localhost:3000"],
  publicUploadDir,
}: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  if (process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
      const start = performance.now();
      res.on("finish", () => {
        console.log(
          `[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${(performance.now() - start).toFixed(1)}ms`,
        );
      });
      next();
    });
  }

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        // Tanpa Origin = server-to-server (Next BFF, curl). Browser harus cocok.
        callback(null, !origin || corsOrigins.includes(origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ data: { status: "ok", service: "caterhub-api", uptime: Math.round(process.uptime()) } });
  });

  if (publicUploadDir) {
    app.use(
      "/uploads",
      express.static(publicUploadDir, {
        fallthrough: true,
        maxAge: "1h",
        setHeaders(res) {
          res.setHeader("X-Content-Type-Options", "nosniff");
        },
      }),
    );
  }

  if (api) app.use("/api/v1", api);
  app.use("/api/v1/vendors", vendorsRouter(vendors));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
