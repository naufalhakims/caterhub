# CaterHub

Marketplace + operasional catering UMKM: cari vendor (tanggal, jam, pax, paket) → permintaan pesanan → konfirmasi vendor + biaya tambahan → pembayaran lunas → persiapan → rating → dashboard vendor/admin. Membuat acara bersifat opsional, hanya untuk memudahkan pencarian.

Repo ini sudah **dipisah menjadi dua paket** di dalam satu monorepo npm workspaces:

- `frontend/` — Next.js 14 (App Router), **UI saja**. Tidak lagi memakai Prisma, NextAuth, atau bcrypt.
- `backend/` — Express + TypeScript + Prisma. Pemilik database, sesi/JWT, otorisasi, aturan bisnis, dan penyimpanan file.

> **Pembayaran:** hanya **lunas** (tanpa DP/termin). Adapter mock + Midtrans (QRIS) tersedia dengan hardening signature webhook. Vendor baru bisa memulai persiapan setelah pembayaran berstatus `PAID`.

## Arsitektur

```
Browser
  │  cookie httpOnly caterhub_session (JWT HS256)
  ▼
Next.js (UI + middleware + BFF tipis)
  │  fetch server-to-server, cookie diteruskan
  ▼
Express API /api/v1  ──Prisma──>  PostgreSQL
  │
  ├─ backend/public/uploads        (gambar publik, disajikan /uploads/*)
  └─ backend/storage/private       (dokumen verifikasi, hanya lewat API ber-otorisasi)
```

- **Server Components** membaca data lewat `GET /api/v1/...` (`frontend/src/lib/api.ts`).
- **Server Actions** hanyalah BFF: parse `FormData`/input → panggil REST API → `redirect`/`revalidate`. Tidak ada aturan bisnis di sana.
- **Middleware Next** hanya gerbang rute berbasis peran. Otorisasi per-resource (kepemilikan quotation/booking/payment/dokumen) ditegakkan **di API**.
- **Auth**: API menerbitkan JWT `HS256` di cookie httpOnly `caterhub_session`. Next memverifikasi token yang sama memakai `AUTH_SECRET` bersama (Edge-compatible `jose`).
- **Upload**: file divalidasi di API dari magic bytes, bukan hanya MIME klien. Dokumen privat tidak pernah masuk `public/`.

## Struktur

```
frontend/
  src/app             → rute publik, customer, vendor, admin + route handler BFF
  src/server          → server actions tipis (auth, quotation, booking/payment, vendor, admin)
  src/lib             → api client, jwt/session, format, date, money, route-access
  src/components      → komponen UI
backend/
  src/app.ts          → factory Express (injectable untuk test)
  src/api.ts          → router gabungan /api/v1
  src/auth            → JWT, cookie, middleware, login/register
  src/modules         → events, quotations, vendor, profile, admin, payments, views, public
  src/domain          → aturan bisnis murni + transaksi (booking, kapasitas, penawaran, akses)
  src/vendors         → katalog publik (filter, skor, DTO, repository)
  prisma/schema.prisma→ skema + migrasi + seed demo
  storage/private     → dokumen verifikasi (gitignored)
  public/uploads      → gambar publik (gitignored)
docs/BACKEND_SPLIT.md → catatan keputusan & migrasi
```

## Setup lokal

Syarat: Node 18+ (disarankan 20), PostgreSQL 14+.

```bash
npm install                 # memasang workspaces + prisma generate (postinstall backend)
cp .env.example .env        # isi DATABASE_URL + AUTH_SECRET
npm run db:migrate          # atau: npm run db:push untuk DB dev baru
npm run db:seed             # data demo (destruktif untuk data demo lokal)
npm run dev:all             # API :4000 + Next :3000
```

Buka http://localhost:3000.

Alternatif dua terminal:

```bash
npm run api:dev             # http://localhost:4000
npm run dev                 # http://localhost:3000
```

### Variabel lingkungan

Satu `.env` di root dipakai API dan frontend. `frontend/.env.local` opsional menimpa untuk UI.

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `DATABASE_URL` | ya | — | Koneksi PostgreSQL. API berhenti saat start bila kosong. |
| `AUTH_SECRET` | ya | fallback dev | Minimal 32 karakter acak. **Produksi menolak nilai contoh/lemah.** |
| `API_PORT` | tidak | `4000` | Port API. |
| `CORS_ORIGIN` | tidak | `http://localhost:3000` | Origin browser yang diizinkan (pisahkan koma). |
| `APP_URL` | tidak | `http://localhost:3000` | URL publik frontend (dipakai untuk referensi/webhook). |
| `API_BASE_URL` | tidak | `http://127.0.0.1:4000` | Alamat API yang dipanggil frontend. |
| `PAYMENT_PROVIDER` | tidak | `mock` | `mock` atau `midtrans`. |
| `MIDTRANS_SERVER_KEY` | bila midtrans | — | Membuat transaksi **dan** memverifikasi signature webhook. |
| `ALLOW_MOCK_WEBHOOK` | tidak | `false` | Webhook mock tidak terautentikasi; jangan aktifkan di produksi. |
| `UPLOAD_DIR` | tidak | `backend/storage/private` | Folder dokumen verifikasi privat. |
| `PUBLIC_UPLOAD_DIR` | tidak | `backend/public/uploads` | Folder gambar publik. |
| `NEXT_DIST_DIR` | tidak | `.next` | Khusus build verifikasi agar tidak bentrok dengan `next dev`. |

## Akun demo (password: `demo1234`)

| Peran | Email |
|---|---|
| Admin | `admin@caterhub.id` |
| Customer | `pelanggan@demo.id` |
| Vendor 1–5 | `vendor1@demo.id` … `vendor5@demo.id` |

## Matriks akses

Dua lapis:

1. **Middleware Next** (`frontend/src/middleware.ts` + `lib/route-access.ts`, diuji unit) mengarahkan tamu ke login dan peran yang salah ke berandanya.
2. **API** menolak berdasarkan peran dan kepemilikan resource (`backend/src/domain/access.ts`, `requireAuth`/`requireRole`). Ini yang berlaku walau UI diakali.

| Rute | Tamu | CUSTOMER | VENDOR | ADMIN |
|---|---|---|---|---|
| `/`, `/catering`, `/catering/[id]` | ✅ | ✅ | → dasbor vendor | → dasbor admin |
| `/dashboard`, `/events/*`, `/profile` | → login | ✅ | → dasbor vendor | → dasbor admin |
| `/vendor/*` | → login | → dasbor | ✅ | → dasbor admin |
| `/admin/*` | → login | → dasbor | → dasbor vendor | ✅ |
| `/quotations/[id]`, `/bookings/[id]`, `/payments/[id]` | → login | pemilik saja | vendor terkait | tinjauan (chat tetap privat) |

Uji manual yang sudah dilakukan: akses langsung tanpa cookie → redirect; customer membuka quotation/booking milik customer lain → **404**; vendor membuka quotation/booking vendor lain → **404**; customer membuka dokumen privat vendor → **403**; anonim → **401**.

## Alur pesanan

Alur utama memakai `Quotation` sebagai permintaan pesanan (`origin = CUSTOMER_REQUEST`):

1. Pelanggan memilih vendor dan paket, lalu mengisi tanggal, jam, pax, dan lokasi. `Event` dibuat otomatis bila pelanggan belum punya acara.
2. Permintaan masuk sebagai `REQUESTED`. Vendor dapat **mengonfirmasi** (`ACCEPTED`) atau **menolak** (`DECLINED`).
3. Saat konfirmasi, vendor menetapkan ongkir/biaya lain/diskon. Total nota dihitung sistem dan menjadi `Booking` berstatus `PAYMENT_PENDING`.
4. Pelanggan membayar **lunas**. Webhook mengubah booking menjadi `PAID`.
5. Vendor baru bisa memulai `PREPARING` setelah `PAID`, lalu `READY → DELIVERED → COMPLETED`.
6. Pelanggan dapat memberi rating sekali setelah pesanan lunas.

Transisi dijaga `backend/src/domain/quotation-workflow.ts`; setiap aksi dicatat di `QuotationHistory`. Chat **tidak** mengubah status pesanan. Alur `VENDOR_OFFER` lama tetap tersimpan untuk kompatibilitas data, tetapi bukan alur utama.

## Kapasitas & tanggal

- `Availability(vendorId, date)` + `reservedPax`; `date` adalah date-only.
- Tanggal dinormalisasi ke UTC tengah malam; "hari ini" memakai kalender Asia/Jakarta.
- `setDailyCapacity` menolak `maxPax < reservedPax`.
- Konfirmasi vendor memakai transaksi + `SELECT … FOR UPDATE` + recheck kapasitas (anti-overbooking) dan klaim status kondisional (anti double-confirm).
- Kapasitas dicek per tanggal; jam acara disimpan dan ditampilkan ke vendor, belum ada kapasitas per slot jam.

## Verifikasi & unggahan

- Status: `PENDING` → `UNDER_REVIEW` → `VERIFIED` / `NEEDS_INFO` / `REJECTED`.
- Validasi unggahan: maks 5 MB, tipe diperiksa dari magic bytes (JPG/PNG/WEBP/PDF).
- Dokumen privat disajikan `GET /api/v1/documents/:id` untuk ADMIN atau vendor pemilik; frontend mem-proxy lewat `/api/vendor-documents/[id]`.
- Gambar publik (logo, cover, galeri maks 8, menu, paket) disimpan API dan disajikan `/uploads/*` (Next me-rewrite ke API).

## Ringkasan API

Semua respons memakai envelope `{ data }` / `{ error: { code, message, fields? } }`.

| Grup | Endpoint utama |
|---|---|
| Publik | `GET /health`, `GET /api/v1/vendors`, `GET /api/v1/vendors/:id`, `GET /api/v1/capacity` |
| Auth | `POST /api/v1/auth/register`, `/login`, `/logout`; `GET /auth/me`; `PATCH /auth/password`; `GET /auth/config` |
| Profil | `GET/PATCH /api/v1/me` |
| Event | `GET/POST /api/v1/events`, `GET /events/:id` |
| Pesanan | `POST /api/v1/quotations/request`, `GET /quotations/:id`, `POST /quotations/:id/{confirm,decline,messages}` (legacy: `POST /quotations`, `POST /quotations/:id/decision`) |
| Vendor | `GET/PATCH /vendor/me`, `/vendor/dashboard`, `/vendor/analytics`, `/vendor/{menu,packages,capacity,bookings,images,documents,quotations}` |
| Booking | `GET /api/v1/bookings/:id` |
| Pembayaran | `POST /api/v1/payments`, `GET /payments/:id`, `POST /payments/:id/mock-settle`, `POST /payments/webhook` |
| Admin | `GET /api/v1/admin/{dashboard,users,orders,vendors,vendors/:id}`, `PATCH /admin/vendors/:id/verification` |

Detail kontrak, auth, dan batasan ada di [`backend/README.md`](backend/README.md).

## Test & pemeriksaan

```bash
npm test              # frontend 31 + backend 29 unit test
npm run typecheck     # frontend + backend
npm run lint
npm run build         # backend typecheck + frontend production build

# bila `next dev` sedang berjalan (Windows):
$env:NEXT_DIST_DIR=".next-build-check"; npm run build
```

Yang diuji antara lain: matriks rute/RBAC, akses resource (IDOR), kapasitas/tanggal, transisi penawaran, format Rupiah, signature webhook mock/Midtrans, katalog + envelope API.

## Deployment

- Jalankan **dua service**: API (`npm run api:start`) dan Next (`npm run build` lalu `npm run start`).
- Set `API_BASE_URL` frontend ke URL API internal/publik, `CORS_ORIGIN` ke origin frontend, dan `AUTH_SECRET` acak yang **sama** di kedua service.
- Jalankan migrasi dari paket backend: `npm -w backend exec prisma migrate deploy`.
- Filesystem lokal hanya untuk demo. Di platform read-only (mis. Vercel) gunakan object storage untuk `PUBLIC_UPLOAD_DIR`/`UPLOAD_DIR`.
- Jangan set `ALLOW_MOCK_WEBHOOK=true` di produksi.

## Dokumen lain

- [`docs/BACKEND_SPLIT.md`](docs/BACKEND_SPLIT.md) — keputusan, batas modul, catatan migrasi, risiko.
- [`backend/README.md`](backend/README.md) — kontrak API, auth, error, unggahan.
