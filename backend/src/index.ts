import { createApp } from "./app";
import { createApiRouter } from "./api";
import { env } from "./env";
import { db } from "./db";
import { prismaVendorRepository } from "./vendors/repository";

const app = createApp({
  vendors: prismaVendorRepository,
  api: createApiRouter(),
  corsOrigins: env.corsOrigins,
  publicUploadDir: env.publicUploadDir,
});

const server = app.listen(env.port, () => {
  console.log(`[api] CaterHub API siap di http://localhost:${env.port}`);
  console.log(`[api] CORS: ${env.corsOrigins.join(", ")}`);
  console.log(`[api] Upload publik: ${env.publicUploadDir}`);
});

async function shutdown(signal: string) {
  console.log(`[api] ${signal} diterima, menutup server…`);
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
