import cors from "cors";
import express from "express";
import { errorHandler, notFoundHandler } from "./http";
import type { VendorRepository } from "./vendors/dto";
import { vendorsRouter } from "./vendors/routes";

export type AppDeps = {
  vendors: VendorRepository;
  corsOrigin?: string;
};

/**
 * Factory app agar bisa diuji tanpa database (repository di-inject).
 * Semua respons memakai envelope { data } / { error: { code, message } }.
 */
export function createApp({ vendors, corsOrigin = "http://localhost:3000" }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  // Log ringkas per request (berguna untuk POC & debugging; mati saat test).
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

  app.use(
    cors({
      // Hanya origin yang dikonfigurasi yang boleh membaca respons dari browser.
      // Permintaan tanpa Origin (server-to-server, curl) tetap dilayani.
      origin(origin, callback) {
        callback(null, !origin || origin === corsOrigin);
      },
      methods: ["GET", "OPTIONS"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ data: { status: "ok", service: "caterhub-api", uptime: Math.round(process.uptime()) } });
  });

  app.use("/api/v1/vendors", vendorsRouter(vendors));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
