# Analisis Codebase CaterHub

> Sumber: kode di `frontend/` dan `backend/` per commit `73b8d42` (baseline). Perubahan sesudahnya dicatat di [CHANGELOG.md](./CHANGELOG.md); tabel endpoint di bawah sudah diperbarui sampai v0.10.0. Hasil verifikasi lokal: `npm test` → **71 tes lulus** (frontend 32, backend 39); `npm run typecheck` → bersih di kedua paket.

## 1. Gambaran arsitektur

```
Browser
  │  cookie httpOnly "caterhub_session" (JWT HS256, umur 30 hari)
  ▼
Next.js 14 App Router  (frontend/)
  ├─ middleware.ts          → gerbang rute berbasis peran (verifikasi JWT di Edge)
  ├─ Server Components      → GET ke API via lib/api.ts (cookie diteruskan)
  ├─ Server Actions         → BFF tipis: FormData → REST → redirect/revalidate
  └─ Route handlers /api/*  → proxy form (permintaan pesanan, mock-settle, webhook, dokumen)
  ▼  fetch server-to-server
Express 4 + TypeScript  (backend/)  —  /api/v1
  ├─ auth/      JWT, cookie, register/login/logout/password
  ├─ modules/   events, quotations, vendor, profile, admin(+bookings), payments, public, views
  ├─ domain/    aturan bisnis murni + transaksi (booking, capacity, payment, review, access)
  ├─ vendors/   katalog publik (filter, skor rekomendasi, DTO, repository injectable)
  └─ storage.ts upload lokal: publik (/uploads) & privat (dokumen verifikasi)
  ▼  Prisma 5
PostgreSQL
```

Prinsip yang benar-benar dijalankan di kode:

- **Frontend tidak menyentuh database.** Tidak ada import Prisma di `frontend/`.
- **Otorisasi per-resource ada di API** (`requireRole` + cek kepemilikan di setiap handler). Middleware Next hanya gerbang awal.
- **Envelope respons konsisten**: `{ data }` / `{ error: { code, message, fields? } }` (`backend/src/http.ts`).
- **App factory injectable** (`createApp({ vendors, api })`) sehingga katalog bisa diuji tanpa DB.

## 2. Peran & kemampuan aktual

| Peran | Yang benar-benar bisa dilakukan lewat UI |
|---|---|
| **Tamu** | Beranda, katalog `/catering` dengan filter, detail vendor (paket, menu, galeri, ulasan, cek kapasitas). |
| **Pelanggan** | Daftar/masuk, buat acara (opsional), kirim permintaan pesanan untuk satu paket, chat dengan vendor di halaman penawaran, bayar lunas (QRIS mock/Midtrans), lihat status pesanan, beri ulasan setelah lunas, ubah profil & kata sandi. |
| **Vendor** | Lengkapi profil & gambar (logo, cover, galeri ≤8), kelola menu & paket (dengan gambar), unggah dokumen verifikasi, atur kapasitas harian, konfirmasi/tolak permintaan (+ongkir, biaya layanan, diskon), majukan status pesanan, batalkan pesanan, kalender, analitik pendapatan. |
| **Admin** | Dashboard ringkas, daftar vendor + detail + dokumen privat, keputusan verifikasi (tinjau/setujui/minta info/tolak), daftar pengguna, daftar semua pesanan. |

## 3. Model data (Prisma)

Entitas inti dan relasinya:

```
User ─1:1─ VendorProfile ─1:N─ MenuItem ─N:M─ Package (via PackageItem)
  │              ├─1:N─ Availability (vendorId+date unik; maxPax, reservedPax)
  │              ├─1:N─ VendorDocument (privat)
  │              └─1:N─ Review
  ├─1:N─ Event ─1:N─ Quotation ─1:N─ QuotationItem (snapshot nama & harga)
  │                     ├─1:N─ QuotationHistory (audit trail)
  │                     ├─1:N─ OfferMessage (chat)
  │                     └─1:1─ Booking ─1:N─ Payment
  │                                 └─1:1─ Review
  └─1:N─ Notification
```

Catatan penting:

- **Uang disimpan sebagai `Int` rupiah** (tanpa desimal) — tepat untuk IDR.
- **Harga di-snapshot** ke `QuotationItem` dan `Booking.totalAmount`, sehingga perubahan harga paket tidak mengubah pesanan lama.
- Model `Account`, `Session`, `VerificationToken` adalah **sisa NextAuth** dan tidak dipakai lagi.
- `VendorProfile.latitude/longitude` ada di skema tetapi **tidak pernah diisi atau dipakai**.
- `Event.eventType`, `budgetMin/Max` diisi lewat form acara tetapi **tidak ikut skor rekomendasi**.
- `Booking.depositAmount/remainingAmount` adalah sisa konsep DP; sekarang selalu `depositAmount = total`, `remaining = 0`.

## 4. Mesin status

### 4.1 Quotation (`backend/src/domain/quotation-workflow.ts`)

| Origin | Alur yang punya UI | Alur yang hanya ada di API |
|---|---|---|
| `CUSTOMER_REQUEST` | `REQUESTED` → vendor **confirm** → `ACCEPTED` (booking dibuat) / **decline** → `DECLINED` | `REQUESTED` → vendor kirim penawaran → `SENT` |
| `VENDOR_OFFER` | — | `SENT` → pelanggan `accept` / `reject` / `revision` → `REVISION_REQUESTED` → vendor revisi → `SENT` |

`EXPIRED` hanya terjadi saat pelanggan mencoba menerima penawaran yang `expiresAt`-nya lewat — tidak ada job terjadwal.

### 4.2 Booking (`backend/src/domain/booking.ts`)

```
PAYMENT_PENDING ──(webhook settlement)──▶ PAID ─▶ PREPARING ─▶ READY ─▶ DELIVERED ─▶ COMPLETED
       │                                  │         │
       └──────────── CANCELLED ◀──────────┴─────────┘   (hanya vendor yang bisa membatalkan)
```

- `PAID` **hanya** bisa diset oleh hasil webhook/mock-settle, bukan tombol vendor (`canVendorSetBookingStatus`).
- Status `QUOTATION_PENDING`, `QUOTATION_SENT`, `REVISION_REQUESTED`, `CONFIRMED` di enum Booking praktis tidak terpakai.

### 4.3 Payment

`PENDING → SETTLEMENT | FAILED | EXPIRED` — `applyWebhookResult` idempoten dan tidak pernah menurunkan `SETTLEMENT`.

## 5. Alur bisnis utama (end-to-end yang berjalan)

1. **Cari vendor** — `GET /api/v1/vendors?q&city&date&guests&budgetMax`. Hanya vendor `VERIFIED`, maksimal 50 hasil, diurutkan skor deterministik: ketersediaan 30 + kecocokan kapasitas 25 + budget 20 + kota 15 + rating ≤10, disertai daftar alasan ("Sesuai budget", "Lokasi dekat", …).
2. **Permintaan pesanan** — form di detail vendor → route handler Next → `POST /quotations/request`. API memvalidasi vendor terverifikasi, paket aktif milik vendor, tanggal tidak lampau, pax dalam rentang paket, sisa kapasitas; mencegah duplikat (`REQUESTED` di tanggal sama); membuat `Event` otomatis bila pelanggan tidak memilih acara tersimpan.
3. **Konfirmasi vendor** — `POST /quotations/:id/confirm` dengan ongkir/biaya/diskon. Dalam satu transaksi: upsert `Availability`, `SELECT … FOR UPDATE`, cek `reservedPax + tamu ≤ maxPax`, tambah `reservedPax`, set quotation `ACCEPTED`, buat `Booking` `PAYMENT_PENDING`, catat history & notifikasi.
4. **Pembayaran** — `POST /payments` membuat satu `Payment` sebesar sisa tagihan. Mock: tombol "simulasi bayar" → `mock-settle`. Midtrans: Snap redirect URL; webhook diverifikasi SHA-512 + `timingSafeEqual`.
5. **Produksi** — vendor memajukan `PAID → PREPARING → READY → DELIVERED → COMPLETED`.
6. **Ulasan** — setelah lunas (tidak perlu menunggu selesai), satu kali per booking; rating vendor diperbarui inkremental dalam transaksi.
7. **Verifikasi vendor** — vendor unggah dokumen (JPG/PNG/WEBP/PDF ≤5 MB, dicek magic bytes) → status `UNDER_REVIEW` → admin memutuskan; dokumen disajikan lewat route ber-otorisasi dengan `Cache-Control: private, no-store`.

## 6. Peta endpoint ↔ pemakaian di frontend

| Endpoint API | Dipakai UI? |
|---|---|
| `auth/register`, `auth/login`, `auth/logout`, `auth/password` | ✅ |
| `auth/me`, `auth/config` | ❌ (sesi dibaca langsung dari JWT di Next) |
| `GET /vendors`, `GET /vendors/:id`, `GET /capacity` | ✅ |
| `GET/POST /events`, `GET /events/:id` | ✅ |
| `POST /quotations/request`, `GET /quotations/:id`, `/confirm`, `/decline`, `/messages` | ✅ |
| `POST /quotations` (vendor kirim/revisi penawaran) | ✅ sejak v0.5.0 (`OfferEditor`) |
| `POST /quotations/:id/decision` (accept/reject/revisi pelanggan) | ✅ sejak v0.5.0 (panel keputusan pelanggan) |
| `/vendor/*` (dashboard, analytics, menu, packages, capacity, bookings, images, documents, me) | ✅ |
| `/vendor/ingredients`, `/vendor/menu/:id/recipe`, `/vendor/costing`, `/vendor/packages/:id/cost`, `/vendor/production` | ✅ sejak v0.6.0 (Bahan & HPP, Produksi) |
| `/admin/*`, `/bookings/:id`, `/bookings/:id/review` | ✅ |
| `/bookings/:id/invoice`, `/vendor/bookings/offline`, `/vendor/bookings/:id/manual-payment` | ✅ sejak v0.8.0 (invoice, pesanan offline) |
| `/bookings/:id/received`, `/vendor/production/start` | ✅ sejak v0.10.0 (progres otomatis: konfirmasi terima, mulai masak semua) |
| `/payments`, `/payments/:id`, `/payments/:id/mock-settle`, `/payments/webhook` | ✅ |
| `/me` (profil) | ✅ |
| Notifikasi | ✅ sejak v0.2.0 (`/me/notifications`); WhatsApp outbox sejak v0.7.0 (`/me/whatsapp`, `/admin/whatsapp`) |

## 7. Kualitas kode & pengujian

**Kekuatan**

- Pemisahan lapisan rapi (`domain/` murni vs `modules/` HTTP). Pesan error berbahasa Indonesia konsisten.
- Kontrol konkurensi yang serius untuk kapasitas (row lock) dan ulasan (unique constraint + tangkap `P2002`).
- Keamanan dasar baik: cookie httpOnly + `sameSite=lax`, header `nosniff`/`X-Frame-Options`, CORS whitelist, pesan login generik, cek `AUTH_SECRET` di produksi, path traversal dicegah pada storage, stack trace tidak bocor.
- Tanggal ditangani sebagai *date-only* dengan zona `Asia/Jakarta` (`lib/date.ts`) — menghindari bug geser hari.

**Cakupan tes saat ini** (semua unit, tanpa DB):

| Paket | Berkas | Yang diuji |
|---|---|---|
| backend | `domain.test.ts`, `capacity.test.ts`, `payment.test.ts`, `review.test.ts`, `vendors.test.ts` | aturan transisi, kalkulasi total, signature Midtrans, kelayakan ulasan, filter & endpoint katalog (repo palsu) |
| frontend | `route-access`, `quotation-workflow`, `date`, `money` | matriks akses rute, aturan status, util tanggal & rupiah |

**Belum ada**: integration test terhadap PostgreSQL (transaksi booking, race overbooking), test E2E alur pelanggan→vendor→bayar, CI.

**Duplikasi yang disadari**: `scoreVendor` dan `quotation-workflow` ada di dua paket (komentar di kode sendiri menandai sebagai sementara).

## 8. Perbedaan kode vs dokumen lama

| Dokumen lama menyebut | Kenyataan di kode |
|---|---|
| Pelanggan dapat "customize menus" (`CATERHUB_CONTEXT.md`) | Pelanggan hanya memilih satu paket utuh; harga add-on `MenuItem.price` ditampilkan tetapi tidak bisa dipilih. |
| Alur penawaran/negosiasi & revisi | Logikanya ada di API, tetapi UI hanya mendukung alur "permintaan → konfirmasi". |
| Notifikasi | Ditulis ke DB di banyak tempat, tidak pernah ditampilkan. |
| "Lokasi dekat" | Hanya kesamaan string nama kota, bukan jarak. |
