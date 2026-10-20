# CaterHub

Marketplace + operasional catering UMKM: acara → rekomendasi vendor → permintaan/penawaran → booking (recheck kapasitas transaksional) → bayar QRIS → dashboard vendor.

> **Status pembayaran:** integrasi payment sengaja *ditunda*. Yang ada hanya adapter mock + Midtrans (QRIS) lama dengan hardening keamanan. Fokus rilis ini: auth/authz, kapasitas, profil, verifikasi, gambar, chat, dan alur permintaan vs penawaran.

## Syarat

- Node 18+ (disarankan 20)
- PostgreSQL 14+ (atau Neon/Supabase)
- `PAYMENT_PROVIDER=mock` untuk dev tanpa Midtrans

## Setup lokal

```bash
npm install
cp .env.example .env    # isi DATABASE_URL + AUTH_SECRET
npx prisma migrate dev  # menerapkan semua migrasi (termasuk migrasi baru)
npm run db:seed
npm run dev
```

Buka http://localhost:3000.

### Variabel lingkungan

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | Koneksi PostgreSQL. |
| `AUTH_SECRET` | ya | Minimal 32 karakter acak. **Produksi menolak nilai contoh** (`ganti-…`) saat server start; `next build` tidak membutuhkannya. |
| `AUTH_URL` | tidak | URL publik aplikasi (mis. `https://caterhub.example`). |
| `PAYMENT_PROVIDER` | tidak | `mock` (default) atau `midtrans`. |
| `MIDTRANS_SERVER_KEY` | bila midtrans | Dipakai membuat transaksi **dan** memverifikasi signature webhook. |
| `ALLOW_MOCK_WEBHOOK` | tidak | Default `false`. Webhook mock tidak terautentikasi — jangan aktifkan di produksi. Alur demo memakai `/api/payments/mock-settle` (butuh login). |
| `UPLOAD_DIR` | tidak | Lokasi penyimpanan dokumen privat. Default `./storage`. |
| `API_BASE_URL` | tidak | POC pemisahan: alamat API Express. Kosong = Next memakai Prisma langsung. |
| `API_TIMEOUT_MS` | tidak | Batas waktu panggilan API sebelum fallback ke Prisma. Default `1500`. |

## Akun demo (password: `demo1234`)

| Peran    | Email              |
|----------|--------------------|
| Admin    | admin@caterhub.id  |
| Customer | pelanggan@demo.id  |
| Vendor 1–5 | vendor1@demo.id … vendor5@demo.id |

## Matriks akses

Ditegakkan di `src/middleware.ts` (matriks murni di `src/lib/route-access.ts`, diuji unit) **dan** di server action/halaman (`requireRole`, `requireCustomer`, `requireVendor`, `canView*`).

| Rute | Tamu | CUSTOMER | VENDOR | ADMIN |
|---|---|---|---|---|
| `/`, `/catering`, `/catering/[id]` | ✅ | ✅ | → dasbor vendor | → dasbor admin |
| `/dashboard`, `/events/*`, `/profile` | → login | ✅ | → dasbor vendor | → dasbor admin |
| `/vendor/*` | → login | → dasbor | ✅ | → dasbor admin |
| `/admin/*` | → login | → dasbor | → dasbor vendor | ✅ |
| `/quotations/[id]`, `/bookings/[id]`, `/payments/[id]` | → login | pemilik saja | vendor terkait | tinjauan (chat tetap privat) |

Tombol navigasi disembunyikan sesuai peran, tetapi **bukan itu satu-satunya kontrol**: setiap halaman detail memeriksa kepemilikan di server (`src/server/access.ts`).

## Alur permintaan vs penawaran

Dua jalur dipisahkan eksplisit melalui `Quotation.origin`:

1. **Permintaan pelanggan** (`CUSTOMER_REQUEST`)
   Pelanggan memilih paket → `POST /api/quotations/request` → status **`REQUESTED`**.
   Vendor harus memutuskan lebih dulu:
   - **Kirim penawaran** (boleh mengubah harga/item) → `SENT`, atau
   - **Tolak** → `DECLINED`.
   Pelanggan melihatnya di **Dashboard → Permintaan pesanan** (bukan sebagai penawaran vendor).

2. **Penawaran vendor** (`VENDOR_OFFER`)
   Vendor mengirim penawaran langsung → `SENT` → pelanggan menerima / menolak / minta revisi.

Transisi dijaga `src/server/quotation-workflow.ts` (tabel transisi + aturan per peran/origin) dan diterapkan di server action. Status terminal (`ACCEPTED`, `REJECTED`, `DECLINED`, `EXPIRED`) tidak bisa berpindah lagi. Setiap aksi dicatat di `QuotationHistory` dan tampil sebagai **Riwayat penawaran**.

> Chat **tidak** mengubah status penawaran dan tidak menggantikan tombol revisi/terima/tolak.

## Kapasitas & tanggal

- `Availability(vendorId, date)` + `reservedPax`; `date` adalah **date-only**.
- Semua tanggal dinormalisasi ke UTC tengah malam via `src/lib/date.ts` (`parseDateOnly`, `toDateOnly`).
- SQL mentah mengikat literal `"YYYY-MM-DD"` lalu `::date` — tidak bergantung zona waktu sesi.
- "Hari ini" memakai kalender **Asia/Jakarta** (`todayDateOnly()`), bukan jam lokal server.
- `setDailyCapacity` menolak `maxPax < reservedPax` sehingga kapasitas tidak bisa menimpa pesanan yang sudah masuk.
- Terima penawaran: `INSERT … ON CONFLICT DO NOTHING` + `SELECT … FOR UPDATE` + recheck dalam satu transaksi (anti-overbooking), ditambah klaim status kondisional agar dua klik "terima" tidak membuat dua booking.

> Data `Availability` lama (sebelum perbaikan) bisa bergeser satu hari. `npm run db:seed` bersifat destruktif terhadap data demo lokal dan aman untuk digunakan ulang.

## Verifikasi vendor

Status: `PENDING` → `UNDER_REVIEW` → `VERIFIED` / `NEEDS_INFO` / `REJECTED`.

- Vendor mengunggah di `/vendor/verification`: izin usaha/NIB, foto tempat usaha, foto dapur, menu/paket, dokumen lain.
- Validasi: maks 5 MB, isi file diperiksa dari **magic bytes** (JPG/PNG/WEBP/PDF), bukan hanya MIME klien.
- Dokumen disimpan **di luar `public/`** (`storage/private/verification`) dan hanya disajikan lewat `GET /api/vendor-documents/[id]` yang memeriksa peran (ADMIN atau vendor pemilik).
- Admin meninjau di `/admin/vendors/[id]`: lihat dokumen, setujui, minta perbaikan (catatan wajib), atau tolak.

## Gambar publik

- Logo, cover, dan galeri vendor (maks 8) di `/vendor/profile`.
- Gambar menu & paket di halaman masing-masing (form ubah tersedia per item).
- Semua unggahan gambar divalidasi (tipe & ukuran), gambar lama dihapus saat diganti, URL konsisten di `/uploads/...`.
- Marketplace menampilkan cover/logo/galeri di kartu & halaman vendor.

## Format Rupiah

- Komponen `src/components/ui/RupiahInput.tsx`: menampilkan `Rp10.000` saat mengetik/menempel/menghapus, dengan perawatan posisi kursor.
- Nilai yang dikirim ke server selalu angka murni (hidden input); server memvalidasi lewat `zIdr` / `zIdrOptional` (`src/lib/money.ts`).
- Presentasi memakai `formatIDR` (id-ID) → `Rp10.000` tanpa spasi.
- Tidak ada desimal: nilai disimpan sebagai integer Rupiah (`Int`).

## Pembayaran

- Abstraksi `PaymentProvider` di `src/server/payment.ts`.
- `PAYMENT_PROVIDER=mock` → QR mock + tombol simulasi (butuh login & kepemilikan booking).
- `PAYMENT_PROVIDER=midtrans` → Snap QRIS; **signature SHA512 wajib** dan dibandingkan timing-safe.
- Webhook: `POST /api/payments/webhook`. `applyWebhookResult` berada di modul internal (`src/server/payment-apply.ts`) — bukan server action yang bisa dipanggil klien.

## Test & pemeriksaan

```bash
npm test          # 60 unit test: routing/RBAC, akses resource, kapasitas/tanggal,
                  # alur penawaran, format Rupiah, signature webhook, klien API
npm run typecheck
npm run lint
npm run build

npm run api:test       # 11 test API Express (envelope, validasi, CORS, error)
npm run api:typecheck
```

## POC pemisahan backend (Express)

Irisan vertikal pertama sudah dipindah ke service terpisah: **katalog vendor**
(`GET /api/v1/vendors`, `GET /api/v1/vendors/:id`). Next tetap menjadi frontend.

```bash
npm run api:dev                     # API di http://localhost:4000 (terminal 1)

# PowerShell (terminal 2)
$env:API_BASE_URL="http://127.0.0.1:4000"; npm run dev
# bash
API_BASE_URL="http://127.0.0.1:4000" npm run dev
```

- Tanpa `API_BASE_URL`, aplikasi berjalan persis seperti sebelumnya (Prisma di Next).
- Bila API mati/timeout, katalog **otomatis fallback** ke Prisma dan menulis warning —
  halaman tidak ikut mati.
- Endpoint publik & read-only; tidak ada data internal (userId, dokumen) di DTO.
- Detail kontrak, env, dan batasan: [`backend/README.md`](backend/README.md).

Hasil ukur lokal (200 request, keep-alive, tanpa cache; detail di `docs/BACKEND_SPLIT.md`):

| Jalur | p50 | p95 |
|---|---|---|
| Prisma langsung | 0,91 ms | 1,18 ms |
| HTTP API | 2,40 ms | 4,13 ms |

Overhead pemisahan ≈ **+1,5 ms p50** untuk endpoint ini — jauh di bawah waktu render
halaman, sehingga keputusan lanjut/tidaknya migrasi harus berbasis modul berikutnya,
bukan angka ini saja.

## Struktur

```
src/app            → routes (public, customer, vendor, admin) + API routes
src/server         → domain logic & server actions (modul "use server" hanya berisi aksi)
src/lib            → util lintas lapis (date, money, roles, route-access, format)
src/components     → UI kecil (Card, Button, Field, RupiahInput, AutoRefresh)
prisma/schema.prisma → entitas + migrasi di prisma/migrations
prisma/seed.ts     → data demo

backend/           → POC API Express + TS + Prisma (katalog vendor)
backend/src        → app, http, vendor (filters, DTO, repository, routes)
backend/test       → 11 test (tanpa DB, repository di-inject)
backend/scripts    → bench Prisma vs HTTP
```

## Catatan deployment

- Penyimpanan file memakai filesystem lokal (demo). Vercel bersifat read-only/tidak persisten — ganti `src/server/storage.ts` dengan object storage (S3/R2) untuk produksi.
- Jalankan `prisma migrate deploy` saat deploy.
- Set `AUTH_SECRET` acak; jangan set `ALLOW_MOCK_WEBHOOK=true` di produksi.
- POC backend: jalankan `backend` sebagai service kedua (port `API_PORT`) dan set
  `API_BASE_URL` di frontend. Skema Prisma tetap satu; jalankan `prisma generate`
  di root. Untuk produksi, backend perlu proses build/CI sendiri dan `DATABASE_URL`
  dengan role read-only untuk endpoint publik.
- Lihat `docs/BACKEND_SPLIT.md` untuk evaluasi, hasil ukur, dan rencana migrasi.
