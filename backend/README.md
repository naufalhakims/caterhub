# CaterHub API

REST API Express + TypeScript + Prisma. Paket ini adalah **sumber tunggal** untuk database, autentikasi/sesi, otorisasi, aturan bisnis, dan penyimpanan file. Frontend Next.js hanya UI + BFF tipis.

Base URL: `http://localhost:4000` (port dari `API_PORT`). Semua endpoint bisnis di bawah `/api/v1`.

## Menjalankan

Dari root repo:

```bash
npm install
cp .env.example .env          # DATABASE_URL + AUTH_SECRET
npm run db:migrate && npm run db:seed
npm run api:dev               # tsx watch, http://localhost:4000
```

Produksi/demo tanpa watch:

```bash
npm run api:start
```

Skrip dari dalam `backend/`: `npm run dev`, `npm start`, `npm run typecheck`, `npm test`, `npm run db:migrate`, `npm run db:push`, `npm run db:seed`.

## Konfigurasi

`.env` root dibaca lebih dulu; `backend/.env` opsional menimpa.

| Variabel | Default | Keterangan |
|---|---|---|
| `DATABASE_URL` | wajib | PostgreSQL. Server keluar bila kosong. |
| `AUTH_SECRET` | fallback dev | JWT HS256. Produksi menolak nilai < 32 karakter/placeholder. |
| `API_PORT` | `4000` | Port HTTP. |
| `CORS_ORIGIN` | `http://localhost:3000` | Origin browser yang diizinkan (daftar dipisah koma). |
| `APP_URL` | `http://localhost:3000` | URL frontend untuk referensi. |
| `UPLOAD_DIR` | `backend/storage/private` | Dokumen verifikasi privat. |
| `PUBLIC_UPLOAD_DIR` | `backend/public/uploads` | Gambar publik. |
| `PAYMENT_PROVIDER` | `mock` | `mock` atau `midtrans`. |
| `MIDTRANS_SERVER_KEY` | kosong | Wajib untuk Midtrans (create + verifikasi signature). |
| `ALLOW_MOCK_WEBHOOK` | `false` | Webhook mock tidak terautentikasi; default ditolak. |

Path folder di-resolve relatif terhadap root repo.

## Auth & otorisasi

- `POST /api/v1/auth/register` dan `/login` menerbitkan JWT HS256 (30 hari) berisi `sub`, `role`, `email`, `name`.
- Token dikirim sebagai cookie httpOnly `caterhub_session` (`SameSite=Lax`, `Path=/`). `POST /auth/logout` menghapusnya.
- `attachUser` membaca cookie untuk semua route. `requireAuth`/`requireRole` menolak dengan 401/403.
- Otorisasi per-resource dicek di modul (contoh: customer hanya boleh membuka quotation/booking/payment miliknya; vendor hanya milik vendornya; admin boleh meninjau tetapi bukan pihak chat).
- Frontend memakai `AUTH_SECRET` yang sama untuk membaca sesi di middleware/server component, lalu meneruskan cookie ke API untuk setiap request data/mutasi.

## Endpoint

### Publik & auth

| Method | Path | Akses |
|---|---|---|
| GET | `/health` | publik |
| GET | `/api/v1/vendors` | publik (katalog `VERIFIED`; filter `q`, `city`, `date`, `guests`, `budgetMax`) |
| GET | `/api/v1/vendors/:id` | publik (detail vendor `VERIFIED`) |
| GET | `/api/v1/capacity?vendorId=&date=&guests=` | publik |
| POST | `/api/v1/auth/register` | publik (`CUSTOMER`/`VENDOR`) |
| POST | `/api/v1/auth/login` | publik |
| POST | `/api/v1/auth/logout` | publik |
| GET | `/api/v1/auth/me` | login |
| PATCH | `/api/v1/auth/password` | login |
| GET | `/api/v1/auth/config` | publik (provider pembayaran) |

### Customer

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/v1/dashboard` | agregat dashboard customer |
| GET/PATCH | `/api/v1/me` | profil |
| GET/POST | `/api/v1/events` | daftar / buat acara |
| GET | `/api/v1/events/:id` | detail acara (milik sendiri) |
| POST | `/api/v1/quotations/request` | permintaan penawaran (`CUSTOMER_REQUEST`) |
| GET | `/api/v1/quotations/:id` | detail penawaran (pihak terkait/admin) |
| POST | `/api/v1/quotations/:id/decision` | terima/tolak/minta revisi |
| POST | `/api/v1/quotations/:id/messages` | chat (hanya pihak terkait) |
| GET | `/api/v1/bookings/:id` | detail booking (pemilik/vendor/admin) |
| POST | `/api/v1/payments` | buat pembayaran |
| GET | `/api/v1/payments/:id` | detail pembayaran (pemilik/admin) |
| POST | `/api/v1/payments/:id/mock-settle` | simulasi lunas (login + pemilik) |
| POST | `/api/v1/payments/webhook` | webhook provider (verifikasi signature) |

### Vendor

| Method | Path | Keterangan |
|---|---|---|
| GET/PATCH | `/api/v1/vendor/me` | profil usaha |
| GET | `/api/v1/vendor/dashboard`, `/analytics` | agregat |
| GET | `/api/v1/vendor/quotations` | semua penawaran vendor |
| GET/POST | `/api/v1/vendor/menu` | daftar / upsert menu (multipart `image` opsional) |
| DELETE | `/api/v1/vendor/menu/:id` | hapus menu |
| GET/POST | `/api/v1/vendor/packages` | daftar / upsert paket (multipart) |
| GET/POST | `/api/v1/vendor/capacity` | kapasitas harian |
| GET | `/api/v1/vendor/bookings` | pesanan vendor |
| POST | `/api/v1/vendor/bookings/:id/advance` | majukan status pesanan |
| POST/DELETE | `/api/v1/vendor/images` | unggah/hapus logo, cover, galeri |
| GET/POST | `/api/v1/vendor/documents` | daftar/unggah dokumen verifikasi |
| DELETE | `/api/v1/vendor/documents/:id` | hapus dokumen (hanya bila belum `VERIFIED`) |
| POST | `/api/v1/quotations` | kirim penawaran (vendor) |
| POST | `/api/v1/quotations/:id/decline` | tolak permintaan |

### Admin

| Method | Path |
|---|---|
| GET | `/api/v1/admin/dashboard` |
| GET | `/api/v1/admin/users` |
| GET | `/api/v1/admin/orders` |
| GET | `/api/v1/admin/vendors` |
| GET | `/api/v1/admin/vendors/:id` |
| PATCH | `/api/v1/admin/vendors/:id/verification` |

### Dokumen privat

`GET /api/v1/documents/:id` — hanya `ADMIN` atau vendor pemilik. Respons file mentah dengan `Content-Disposition: inline`, `Cache-Control: private, no-store`, dan `X-Content-Type-Options: nosniff`.

## Envelope & error

```json
{ "data": { } }
```

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Data tidak valid.",
             "fields": { "email": ["Email tidak valid."] } } }
```

| Status | Code umum | Kapan |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `WEBHOOK_REJECTED` | Input/webhook tidak valid |
| 401 | `UNAUTHENTICATED` | Cookie tidak ada/kedaluwarsa |
| 403 | `FORBIDDEN` | Peran/kepemilikan tidak sesuai |
| 404 | `NOT_FOUND`, `VENDOR_NOT_FOUND`, `BOOKING_NOT_FOUND` | Resource tidak ada/tidak boleh diketahui |
| 409 | `CONFLICT`, `OVERBOOKED`, `ALREADY_PAID`, … | Aturan bisnis |
| 500 | `INTERNAL_ERROR` | Kesalahan tak terduga (detail tidak dibocorkan) |

## Unggahan

- Maks 5 MB. Tipe ditentukan dari **magic bytes**: JPG, PNG, WEBP, PDF.
- Gambar publik: `backend/public/uploads/...`, URL `/uploads/...`, disajikan static oleh API dan di-rewrite Next.
- Dokumen privat: `backend/storage/private/verification/...`, **tidak** disajikan static.
- Folder disanitasi per segmen; gambar lama dihapus saat diganti.
- Produksi: ganti filesystem dengan object storage (S3/R2) + signed URL.

## Test

```bash
npm -w backend test        # atau: npm run api:test
npm -w backend run typecheck
```

29 test: katalog/envelope/validasi/CORS/error (11), domain penawaran/booking/akses/skor (9), kapasitas/tanggal (3), keamanan webhook mock & signature Midtrans (6).

## Batasan

- Belum ada rate limit, refresh token/rotasi sesi, atau observability terstruktur.
- Satu `AUTH_SECRET` dipakai bersama frontend & API; rotasi secret akan mengeluarkan semua sesi.
- Penyimpanan file masih lokal (demo).
- Pembayaran sengaja ditunda; hanya adapter mock/Midtrans + hardening.
- `tsx` dipakai untuk menjalankan TypeScript; belum ada pipeline build/Docker khusus backend.
