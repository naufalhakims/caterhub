# Pemisahan frontend/backend: evaluasi, POC, dan rencana

Status: **POC irisan vertikal pertama sudah diimplementasikan.** Migrasi penuh
belum dilakukan dan tidak boleh dilakukan sekaligus.

Yang sudah dipindah: katalog vendor publik (`GET /api/v1/vendors`,
`GET /api/v1/vendors/:id`) ke `backend/` (Express + TypeScript + Prisma).
Yang masih di Next: auth/sesi, permintaan & penawaran, booking/kapasitas,
pembayaran, chat, verifikasi, unggahan, dan seluruh UI.

## 1. Kondisi awal (baseline)

- Next.js 14 App Router, satu proses. Server Components membaca Prisma langsung;
  mutasi memakai Server Actions.
- Business logic terkumpul di `src/server/*`, tidak bergantung React kecuali
  `redirect()`/`revalidatePath()` di file `"use server"`.
- Otorisasi: `src/middleware.ts` + `src/lib/route-access.ts` (matriks rute) dan
  `src/server/access.ts` (kepemilikan resource).

### Bukti ukuran build

| Rute | First Load JS |
|---|---|
| Sebagian besar rute | ~96,3 kB |
| `/`, `/catering`, `/events/new`, `/vendor/quotations` | ~110 kB |
| `/vendor/analytics` (Recharts) | 183 kB |
| Middleware | 120 kB |

Kesimpulan: ukuran bundle **bukan** bottleneck utama. Biaya terbesar ada pada
query Prisma per request dan render server, bukan pada pemisahan proses.

## 2. Evaluasi opsi backend

| Opsi | Kelebihan | Kekurangan untuk kasus ini |
|---|---|---|
| **Express + TypeScript + Prisma** | Reuse skema, Zod, dan modul domain; kurva belajar rendah; mudah di-deploy terpisah. | Struktur/guard/validasi error harus disusun sendiri. |
| NestJS | Modul/guard/decorator rapi untuk jangka panjang. | Rewrite besar (DI, decorator); overhead untuk tim kecil. |
| Go (Fiber/Echo) | Performa & memori terbaik; binary tunggal. | Menulis ulang domain + validasi; Prisma tidak tersedia; risiko regresi tinggi. |
| Laravel | Ekosistem matang, auth/RBAC bawaan. | Dua bahasa, dua ORM; seluruh logika ditulis ulang. |
| Supabase/PostgREST | Cepat untuk CRUD. | Aturan transaksional (kapasitas, transisi status) sulit dijaga; RLS menambah kompleksitas. |

**Keputusan: Express + TypeScript + Prisma.** Risiko rewrite paling rendah karena
skema, migrasi, Zod, dan modul domain bisa dipakai ulang; Next.js tetap frontend.

## 3. Arsitektur POC

```
Browser ──> Next.js (UI + server actions) ──fetch──> Express API ──Prisma──> PostgreSQL
                     │                                   │
                     └── fallback Prisma (bila API mati) ┘
```

- `backend/` adalah paket terpisah (dependency & proses sendiri, port `4000`).
- **Satu skema Prisma** dipakai bersama; Prisma Client di-generate di root, bukan
  di backend, agar tidak bentrok dengan dev server Next di Windows.
- Kontrak: envelope `{ data }` / `{ error: { code, message, fields? } }`, status
  HTTP benar (400/404/500), versi di `/api/v1`.
- Next memakai API hanya bila `API_BASE_URL` diisi (`src/lib/vendor-api.ts`).
  Timeout `API_TIMEOUT_MS` (default 1500 ms) → fallback Prisma + warning.
- Validasi & skor rekomendasi dihitung di API. Skor **masih diduplikasi** dari
  `src/server/marketplace.ts` selama POC (ditandai komentar); setelah diterima,
  API menjadi sumber tunggal dan salinan di Next dihapus.

### Endpoint

| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Liveness. |
| GET | `/api/v1/vendors` | Daftar vendor `VERIFIED`, filter `q/city/date/guests/budgetMax`, skor + alasan. |
| GET | `/api/v1/vendors/:id` | Detail publik (paket, menu, ulasan); 404 bila tidak ada/belum terverifikasi. |

DTO tidak memuat `userId`, `verificationNote`, `reviewedById`, atau dokumen privat.

## 4. Hasil pengukuran

Metodologi: 200 request, 20 warmup, keep-alive `node:http`, tanpa cache, API & DB
di mesin yang sama (Windows, PostgreSQL lokal). Jalankan ulang: `npm run bench:api`.

| Jalur | mean | p50 | p95 |
|---|---|---|---|
| Prisma langsung (daftar) | 0,95 ms | 0,91 ms | 1,18 ms |
| HTTP `GET /api/v1/vendors` | 2,49 ms | 2,40 ms | 4,13 ms |
| HTTP + filter (city/guests/date) | 2,25 ms | 1,96 ms | 3,98 ms |

Overhead pemisahan proses: **+1,5 ms p50 / +3 ms p95**. Angka ini kecil dibanding
render halaman dan query nyata pada data besar, tetapi **belum** termasuk biaya
jaringan antar-service di produksi.

Catatan penting: `fetch` (undici) di Windows menambah ±15 ms per request bahkan
untuk `/health`. Pengukuran awal yang memakai `fetch` menyesatkan; bench final
memakai `node:http` + keep-alive. Jangan mengutip angka fetch sebagai overhead API.

### Verifikasi paritas

- Tanpa filter: Next (Prisma) = 6 vendor, API = 6 vendor.
- Filter `city=Surabaya&guests=250&date=2026-10-26`: keduanya 4 vendor, **urutan ID identik**.
- Log API membuktikan Next memanggil endpoint saat `API_BASE_URL` aktif.
- Fallback diuji unit: API error/timeout/bentuk salah → Prisma, halaman tetap 200.

## 5. Keamanan & batasan POC

- Endpoint publik, read-only; tidak ada auth karena belum ada data privat.
- Belum ada rate limit, cache HTTP, atau observability terstruktur.
- CORS dibatasi `CORS_ORIGIN`; permintaan tanpa Origin (server-to-server) tetap dilayani.
- Belum ada Docker/CI khusus backend; deploy masih satu repo.
- Belum ada test kontrak lintas service (baru test unit + verifikasi manual).

## 6. Langkah berikutnya (setelah POC diterima)

1. **Jadikan API sumber tunggal katalog**: hapus jalur Prisma + skor duplikat di
   Next, tambah cache HTTP (`Cache-Control: public, s-maxage=30`) dan test kontrak.
2. **Auth terpusat**: pindahkan verifikasi kredensial & sesi ke API (cookie
   httpOnly, rotasi, CSRF untuk mutasi), Next hanya membaca sesi. Ini prasyarat
   sebelum modul transaksional dipindah.
3. **Modul berikutnya** (satu per satu, dengan gate ukur): permintaan/penawaran →
   booking/kapasitas → verifikasi/unggahan → pembayaran.
4. **Gate kualitas per modul**: typecheck, lint, unit + contract test, smoke E2E,
   p95 tidak lebih buruk dari baseline, tidak ada pemanggilan Prisma tersisa di Next
   untuk modul yang sudah dipindah.
5. **Deployment**: dua service, `DATABASE_URL` read-only untuk endpoint publik,
   object storage untuk unggahan, health check & graceful shutdown (sudah ada di POC).

## 7. Risiko & mitigasi

- **Dua sumber kebenaran saat transisi** → satu modul dipindah sekaligus; larang
  duplikasi aturan bisnis setelah modul dinyatakan selesai.
- **Regresi otorisasi** → pindahkan `canView*`/matriks rute ke paket bersama yang
  diuji di kedua sisi; jangan pernah mengandalkan UI.
- **Sesi lintas origin** → samakan domain/cookie `SameSite`, uji CSRF.
- **Unggahan file** → object storage + signed URL, jangan salin filesystem lokal.
- **Biaya jaringan produksi** → ukur p95 antar-service sebelum memindah modul
  berikutnya; bila lebih buruk dari baseline, pertahankan modul di Next.

## 8. Rollback

Kosongkan `API_BASE_URL` → seluruh trafik katalog kembali ke Prisma di Next tanpa
perubahan kode. Folder `backend/` bisa dihapus tanpa memengaruhi aplikasi utama.
