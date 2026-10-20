# Rencana pemisahan frontend/backend

Dokumen ini mencatat evaluasi, keputusan, dan langkah migrasi bertahap. **Pemisahan belum
dieksekusi** — sesuai prioritas, fitur & keamanan (auth, kapasitas, profil, verifikasi,
gambar, chat, alur permintaan/penawaran) diselesaikan lebih dulu, lalu diukur.

## 1. Kondisi saat ini (baseline)

- Next.js 14 App Router, satu proses. Server Components membaca Prisma langsung;
  mutasi memakai Server Actions.
- Business logic sudah terkumpul di `src/server/*` dan tidak bergantung pada React,
  kecuali pemanggilan `redirect()`/`revalidatePath()` di file `"use server"`.
- Otorisasi: `src/middleware.ts` + `src/lib/route-access.ts` (matriks rute) dan
  `src/server/access.ts` (kepemilikan resource) dipakai halaman maupun aksi.

### Bukti pengukuran (build produksi)

| Rute | First Load JS |
|---|---|
| Sebagian besar rute | ~96,3 kB |
| `/`, `/catering`, `/events/new`, `/vendor/quotations` | ~110 kB |
| `/vendor/analytics` (Recharts) | 183 kB |
| Middleware | 120 kB |

Kesimpulan: ukuran bundle **bukan** bottleneck utama. Rute bertanda `ƒ` dirender
dinamis; biaya terbesar ada pada query Prisma per request, kompilasi dev, dan
perjalanan bolak-balik server action. Optimasi harus dimulai dari query/indeks dan
caching, bukan memecah proses.

## 2. Evaluasi opsi backend

| Opsi | Kelebihan | Kekurangan untuk kasus ini |
|---|---|---|
| **Express + TypeScript + Prisma** | Reuse 100% skema Prisma, Zod, dan modul domain; kurva belajar rendah; mudah di-deploy terpisah. | Perlu menyusun sendiri struktur, validasi error, dan RBAC middleware. |
| NestJS | Struktur modul/guard/decorator rapi; cocok jangka panjang. | Rewrite besar (DI, decorator), overhead untuk tim kecil/lomba. |
| Go (Fiber/Echo) | Performa & memori terbaik; binary tunggal. | Menulis ulang domain + validasi; Prisma tidak tersedia (butuh sqlc/GORM), risiko regresi tinggi. |
| Laravel | Ekosistem matang, auth/RBAC bawaan. | Dua bahasa, dua ORM; seluruh logika harus ditulis ulang. |
| Supabase/PostgREST langsung | Cepat untuk CRUD. | Aturan bisnis transaksional (kapasitas, transisi status) sulit dijaga; RLS menambah kompleksitas. |

**Keputusan: Express + TypeScript + Prisma.** Risiko rewrite paling rendah karena
skema, migrasi, Zod, dan modul domain bisa dipakai ulang; Next.js tetap menjadi frontend.

## 3. Target arsitektur

```
Browser ── Next.js (UI, BFF ringan) ──HTTP──> Express API ──> PostgreSQL
                     │                            │
                     └── cookie sesi (httpOnly) ──┘
```

- Next.js: rendering, form, komponen; tanpa akses Prisma.
- Express: validasi (Zod), autentikasi sesi/JWT, RBAC, aturan bisnis, akses data,
  transaksi (kapasitas, booking), penyimpanan file.
- Kontrak: REST JSON, envelope konsisten `{ data }` / `{ error: { code, message, fields? } }`,
  status HTTP benar (400/401/403/404/409/422), versi di `/api/v1`.

## 4. Langkah migrasi bertahap

1. **Ukur (selesai sebagian).** Catat ukuran build, waktu render rute, jumlah query per
   halaman, dan query lambat (`EXPLAIN ANALYZE`). Tambahkan indeks yang terbukti kurang.
2. **POC satu irisan vertikal.** Pindahkan `GET /api/v1/vendors` + `GET /api/v1/vendors/:id`
   ke Express; Next memanggil lewat `fetch`. Ukur sebelum/sesudah (latensi p50/p95,
   jumlah query, ukuran bundle).
3. **Auth terpusat.** Pindahkan verifikasi kredensial & sesi ke Express (cookie
   httpOnly, rotasi, CSRF untuk mutasi), Next hanya membaca sesi.
4. **Domain per modul**, urutan: katalog → permintaan/penawaran → booking/kapasitas →
   pembayaran → verifikasi/unggahan.
5. **Matikan jalur lama** setelah setiap modul punya test kontrak dan tidak ada
   pemanggilan Prisma tersisa di Next.
6. **Gate kualitas:** typecheck, lint, unit + contract test, smoke E2E per modul,
   metrik p95 tidak lebih buruk dari baseline.

## 5. Risiko & mitigasi

- **Dua sumber kebenaran saat transisi** → satu modul dipindah sekaligus; jangan
  menduplikasi aturan bisnis.
- **Sesi lintas origin** → samakan domain/cookie `SameSite`, uji CSRF.
- **Unggahan file** → object storage + signed URL; jangan salin filesystem lokal.
- **Regresi otorisasi** → pindahkan `canView*`/matriks rute ke paket bersama yang diuji
  di kedua sisi hingga migrasi selesai.
