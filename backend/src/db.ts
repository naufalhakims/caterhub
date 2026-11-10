import { PrismaClient } from "@prisma/client";
import { env } from "./env";

export const db = new PrismaClient({
  datasources: { db: { url: env.databaseUrl } },
  // Default Prisma (maxWait 2 dtk, timeout 5 dtk) terlalu ketat untuk transaksi
  // multi-langkah (konfirmasi pesanan, kunci kapasitas, notifikasi) bila latensi ke
  // database tinggi; transaksi ditutup di tengah jalan ("Transaction not found").
  // Batas eksplisit per-transaksi (mis. pembayaran 15 dtk) tetap berlaku.
  transactionOptions: { maxWait: 10_000, timeout: 20_000 },
});
