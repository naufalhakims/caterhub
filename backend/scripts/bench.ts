/**
 * Bench POC: bandingkan query Prisma langsung (jalur lama) dengan HTTP ke API
 * Express (jalur baru). Fokus pada overhead pemisahan proses + serialisasi JSON.
 *
 * Catatan metodologi:
 * - Memakai `node:http` + keep-alive agent, BUKAN `fetch`. Di Windows, undici
 *   `fetch` menambah ±15ms per request bahkan untuk /health (artefak, bukan
 *   biaya server); angka itu tidak boleh dipakai sebagai bukti.
 * - Default host 127.0.0.1 agar tidak ada biaya resolusi nama.
 *
 * Jalankan API lebih dulu (npm run dev), lalu: npm run bench
 * Opsi: BENCH_N=500 BENCH_BASE=http://127.0.0.1:4000
 */
import http from "node:http";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../.env") });

const N = Number(process.env.BENCH_N ?? 200);
const WARMUP = Math.min(20, Math.floor(N / 5));
const BASE = process.env.BENCH_BASE ?? "http://127.0.0.1:4000";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const agent = new http.Agent({ keepAlive: true, maxSockets: 4 });

function percentile(sorted: number[], p: number) {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    mean: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

async function time(fn: () => Promise<unknown>) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

/** GET keep-alive; membaca seluruh body agar koneksi bisa dipakai ulang. */
function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { agent }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
  });
}

/** Query yang sama dengan endpoint daftar (tanpa filter). */
async function directQuery() {
  const rows = await prisma.vendorProfile.findMany({
    where: { verificationStatus: "VERIFIED" },
    include: { packages: { where: { isActive: true }, orderBy: { pricePerPax: "asc" }, take: 1 } },
    orderBy: { rating: "desc" },
    take: 50,
  });
  return rows.length;
}

async function httpQuery(url: string) {
  const res = await get(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const body = JSON.parse(res.body) as { data?: unknown[] };
  return body.data?.length ?? 0;
}

async function run(label: string, fn: () => Promise<unknown>) {
  for (let i = 0; i < WARMUP; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < N; i++) samples.push(await time(fn));
  const s = stats(samples);
  console.log(
    `${label.padEnd(34)} n=${s.n}  mean=${s.mean.toFixed(2)}ms  p50=${s.p50.toFixed(2)}ms  p95=${s.p95.toFixed(2)}ms  min=${s.min.toFixed(2)}  max=${s.max.toFixed(2)}`,
  );
  return s;
}

async function main() {
  const health = await get(`${BASE}/health`).catch(() => null);
  if (!health || health.status !== 200) {
    console.error(`[bench] API tidak merespons di ${BASE}. Jalankan "npm run dev" dulu.`);
    process.exit(1);
  }

  console.log(`[bench] target=${BASE} n=${N} warmup=${WARMUP} (keep-alive, tanpa cache)`);
  const direct = await run("Prisma langsung (daftar)", directQuery);
  const httpList = await run("HTTP GET /api/v1/vendors", () => httpQuery(`${BASE}/api/v1/vendors`));
  const filtered = await run("HTTP + filter (city/guests)", () =>
    httpQuery(`${BASE}/api/v1/vendors?city=Surabaya&guests=250&date=2026-10-26`),
  );

  console.log("\nSelisih HTTP vs Prisma langsung:");
  console.log(`  p50 +${(httpList.p50 - direct.p50).toFixed(2)}ms   p95 +${(httpList.p95 - direct.p95).toFixed(2)}ms`);
  console.log(
    `  filter: p50 ${filtered.p50.toFixed(2)}ms, p95 ${filtered.p95.toFixed(2)}ms (p50 +${(filtered.p50 - direct.p50).toFixed(2)}ms)`,
  );
  console.log("Catatan: API & DB di mesin yang sama; angka produksi akan tergantung jaringan antar-service.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
