# CaterHub API (POC)

REST API Express + TypeScript + Prisma untuk **irisan vertikal pertama**: katalog
vendor publik. Ini POC pemisahan backend/frontend, bukan migrasi penuh.

- Hanya baca (GET), hanya data publik vendor `VERIFIED`.
- Frontend Next.js tetap berjalan seperti biasa. Bila `API_BASE_URL` diisi, halaman
  `/catering` mengambil data dari API ini; bila API mati, otomatis kembali ke Prisma.
- Skema & Prisma Client **dipakai bersama** dengan aplikasi Next (satu
  `prisma/schema.prisma`, satu hasil `prisma generate` di root). Backend tidak
  menjalankan generate sendiri agar tidak bentrok dengan dev server Next di Windows.

## Menjalankan

Dari root repo:

```bash
# 1. API
npm run api:dev          # http://localhost:4000

# 2. Next (terminal lain), dengan katalog dialihkan ke API
#    PowerShell:
$env:API_BASE_URL="http://127.0.0.1:4000"; npm run dev
#    bash:
API_BASE_URL="http://127.0.0.1:4000" npm run dev
```

Tanpa `API_BASE_URL`, Next memakai Prisma langsung (jalur lama).

Variabel (opsional, lihat `.env.example` root dan `backend/.env.example`):

| Variabel | Default | Keterangan |
|---|---|---|
| `API_PORT` | `4000` | Port API. |
| `CORS_ORIGIN` | `http://localhost:3000` | Origin browser yang diizinkan. |
| `DATABASE_URL` | dari `.env` root | Koneksi PostgreSQL. |
| `API_BASE_URL` | kosong | Di sisi Next: alamat API untuk mengaktifkan jalur baru. |
| `API_TIMEOUT_MS` | `1500` | Batas waktu fetch sebelum fallback ke Prisma. |

## Endpoint

### `GET /health`

```json
{ "data": { "status": "ok", "service": "caterhub-api", "uptime": 42 } }
```

### `GET /api/v1/vendors`

Query (semua opsional): `q`, `city`, `date` (`YYYY-MM-DD`), `guests`, `budgetMax`
(alias `budget`). Skor & alasan rekomendasi dihitung di server.

```json
{
  "data": [
    {
      "id": "cmux…",
      "businessName": "Dapur Nusantara",
      "city": "Surabaya",
      "rating": 4.8,
      "reviewCount": 214,
      "startingPrice": 21000,
      "remaining": 600,
      "hasCapacity": true,
      "score": 82,
      "reasons": ["Tersedia pada tanggal acara", "Rating tinggi"],
      "description": "…",
      "logoUrl": null,
      "coverUrl": null
    }
  ],
  "meta": { "count": 6, "filters": { "city": "Surabaya" } }
}
```

### `GET /api/v1/vendors/:id`

Detail publik: profil, paket + item menu, menu tersedia, 5 ulasan terbaru.
Mengembalikan **404** bila vendor tidak ada **atau** belum `VERIFIED`.
Tidak pernah mengembalikan `userId`, `verificationNote`, `reviewedById`, atau dokumen.

## Kontrak error

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Parameter tidak valid.",
             "fields": { "date": ["Format tanggal harus YYYY-MM-DD dan valid."] } } }
```

| Status | Code | Kapan |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Query tidak valid (tanggal, guests, budget). |
| 404 | `VENDOR_NOT_FOUND` | Vendor tidak ada / belum terverifikasi. |
| 404 | `NOT_FOUND` | Rute tidak dikenal. |
| 500 | `INTERNAL_ERROR` | Kesalahan tak terduga; detail tidak dibocorkan. |

## Test & bench

```bash
npm run api:test        # 11 test (envelope, validasi, 404, CORS, error aman)
npm run api:typecheck
npm run bench:api       # butuh API hidup; bandingkan Prisma vs HTTP
```

Hasil bench lokal (Windows, PostgreSQL lokal, 200 request, keep-alive, tanpa cache):

| Jalur | p50 | p95 |
|---|---|---|
| Prisma langsung (daftar) | 0,91 ms | 1,18 ms |
| HTTP `GET /api/v1/vendors` | 2,40 ms | 4,13 ms |
| HTTP + filter (city/guests/date) | 1,96 ms | 3,98 ms |

Overhead pemisahan proses ≈ **+1,5 ms p50 / +3 ms p95** untuk endpoint ini.
Catatan: `fetch` (undici) di Windows menambah ±15 ms per request bahkan ke `/health`;
bench memakai `node:http` + keep-alive agar tidak salah mengukur.

## Batasan POC

- Belum ada autentikasi/otorisasi: endpoint memang publik dan read-only.
- Belum ada rate limit, cache HTTP, atau observability terstruktur.
- Belum di-deploy sebagai service terpisah; belum ada Docker/CI untuk backend.
- Skor rekomendasi masih **diduplikasi** dari `src/server/marketplace.ts`
  (ditandai komentar). Setelah POC diterima, jadikan API sumber tunggal dan hapus
  salinan di Next.
- Hanya katalog vendor yang dipindah. Permintaan/penawaran, booking, kapasitas,
  pembayaran, chat, dan unggahan masih di Next.

## Rollback

Hapus/ kosongkan `API_BASE_URL` → seluruh trafik kembali ke Prisma di Next tanpa
perubahan kode. Folder `backend/` dapat dihapus tanpa memengaruhi aplikasi utama.
