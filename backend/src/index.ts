import { createApp } from "./app";
import { env } from "./env";
import { db } from "./db";
import { prismaVendorRepository } from "./vendors/repository";

const app = createApp({
  vendors: prismaVendorRepository,
  corsOrigin: env.corsOrigin,
});

const server = app.listen(env.port, () => {
  console.log(`[api] CaterHub API (POC) siap di http://localhost:${env.port}`);
  console.log(`[api] CORS origin: ${env.corsOrigin}`);
});

async function shutdown(signal: string) {
  console.log(`[api] ${signal} diterima, menutup server…`);
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
  // Jangan menggantung selamanya bila koneksi masih terbuka.
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
