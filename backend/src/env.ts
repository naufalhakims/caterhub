import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Root repo (backend/src → repo). */
export const repoRoot = path.resolve(here, "../..");

// Root .env dulu, lalu backend/.env menimpa bila ada (konfigurasi khusus API).
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, "backend", ".env"), override: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[api] ${name} belum diisi. Salin .env.example ke .env.`);
    process.exit(1);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === "production";
const authSecret = process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me-please-32";
if (isProduction && (authSecret.length < 32 || /ganti|changeme|secret-random|example|insecure/i.test(authSecret))) {
  console.error("[api] AUTH_SECRET belum aman: gunakan nilai acak minimal 32 karakter.");
  process.exit(1);
}

function resolveDir(value: string | undefined, fallback: string): string {
  return value ? path.resolve(repoRoot, value) : path.join(repoRoot, fallback);
}

export const env = {
  isProduction,
  port: Number(process.env.API_PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  databaseUrl: required("DATABASE_URL"),
  authSecret,
  /** Dokumen verifikasi privat (tidak pernah disajikan sebagai static). */
  privateUploadDir: resolveDir(process.env.UPLOAD_DIR, "backend/storage/private"),
  /** Gambar publik (logo, cover, galeri, menu). */
  publicUploadDir: resolveDir(process.env.PUBLIC_UPLOAD_DIR, "backend/public/uploads"),
  /** Dipakai untuk URL absolut di dokumentasi/webhook bila diperlukan. */
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  paymentProvider: process.env.PAYMENT_PROVIDER ?? "mock",
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY ?? "",
  allowMockWebhook: process.env.ALLOW_MOCK_WEBHOOK === "true",
};
