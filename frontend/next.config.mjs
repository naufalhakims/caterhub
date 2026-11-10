import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));

// Satu sumber konfigurasi di root repo (dipakai API & frontend).
// .env.local di frontend (bila ada) menimpa untuk kebutuhan UI.
dotenv.config({ path: path.resolve(here, "../.env") });
dotenv.config({ path: path.resolve(here, ".env.local"), override: true });

// Cadangan 127.0.0.1 hanya untuk development. Di hosting (Railway menyediakan
// RAILWAY_ENVIRONMENT saat build & runtime) tanpa API_BASE_URL, build gagal di sini,
// bukan diam-diam mengarahkan rewrite /uploads ke localhost.
if (process.env.RAILWAY_ENVIRONMENT && !process.env.API_BASE_URL?.trim()) {
  throw new Error("API_BASE_URL wajib diisi untuk build/start produksi.");
}
const API_BASE_URL = (process.env.API_BASE_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Default .next. Bisa diarahkan agar build verifikasi tidak bentrok dengan
  // `next dev` yang sedang berjalan (mis. NEXT_DIST_DIR=.next-build-check).
  distDir: process.env.NEXT_DIST_DIR || ".next",

  async rewrites() {
    return [
      // Gambar publik disimpan & disajikan API; frontend hanya meneruskan.
      { source: "/uploads/:path*", destination: `${API_BASE_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
