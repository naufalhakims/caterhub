import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Root repo (backend/src → repo). */
export const repoRoot = path.resolve(here, "../..");

// backend/.env menimpa .env root (DATABASE_URL biasanya sudah ada di root).
dotenv.config({ path: path.join(repoRoot, "backend", ".env") });
dotenv.config({ path: path.join(repoRoot, ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[api] ${name} belum diisi. Salin .env root atau backend/.env.example.`);
    process.exit(1);
  }
  return value;
}

export const env = {
  port: Number(process.env.API_PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  databaseUrl: required("DATABASE_URL"),
};
