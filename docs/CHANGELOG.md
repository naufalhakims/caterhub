# Changelog

Catatan perubahan per tahap pengembangan. Versi mengikuti milestone roadmap ([ROADMAP_PENGEMBANGAN.md](./ROADMAP_PENGEMBANGAN.md)), bukan rilis npm.

## v0.16.4 — Redirect ke localhost di produksi (10 Nov 2026)

**Bug**: setelah "Kirim permintaan pesanan" di situs live, browser diarahkan ke `localhost`. Route handler Next membangun URL redirect dari `req.url`; di balik proxy Railway nilainya alamat internal container (`http://localhost:8080`). Pola yang sama ada di `api/payments/mock-settle` (tombol "Simulasikan bayar") dan `middleware.ts`.

**Perbaikan**
- `frontend/src/lib/redirect.ts`: `redirectTo(path)` mengirim header **Location relatif** (selalu tetap di domain yang dibuka pengguna) dan hanya menerima path internal (menolak `https://…`, `//host`, `/\host` → tidak bisa jadi open redirect); `withQuery()` untuk query string; `middlewareRedirect(req, path)` khusus middleware (runtime middleware Next menuntut URL absolut, jadi memakai klon `req.nextUrl` yang direlatifkan Next untuk origin yang sama).
- Dipakai di `api/quotations/request`, `api/payments/mock-settle`, dan `middleware.ts`. Tidak ada lagi `req.url` di kode.
- **Pengaman produksi**: API berhenti saat start bila `APP_URL`/`CORS_ORIGIN` kosong, bukan https, atau localhost/127.x/`*.railway.internal` (`publicUrlProblem` di `backend/src/env.ts`); web gagal build/start di Railway bila `API_BASE_URL` kosong (tidak diam-diam memakai `127.0.0.1`). Nilai Railway saat ini lolos pemeriksaan.
- **Test penjaga**: `frontend/src/lib/redirect.test.ts` memindai seluruh `frontend/src` dan gagal bila ada `req.url`/`request.url` atau `NextResponse.redirect(` di luar `lib/redirect.ts`; ditambah test Location relatif & penolakan open redirect. `backend/test/env-public-url.test.ts` menguji validasi URL produksi.

**Verifikasi (browser, lokal)**: semua header Location relatif (`/dashboard → /login?next=%2Fdashboard`, `/api/quotations/request → /quotations/…`, jalur gagal → `/catering/…?error=…` meski Host publik disimulasikan); tidak ada Location absolut/localhost. Typecheck, lint, 148 unit test (backend 109, frontend 39), `next build` sukses.

## v0.16.3 — Satu kolom lokasi + perbaikan titik kosong (10 Nov 2026)

**Bug yang masih tersisa di v0.16.2**: alamat terisi otomatis, tetapi **titik (latitude/longitude) tetap kosong** sehingga tombol kirim tetap nonaktif. Penyebab: koordinat disimpan di `<input type="hidden" defaultValue>` yang diisi lewat DOM; pada input hidden nilai = atribut default, sehingga setiap render ulang React (mis. status pin berubah) menimpanya kembali kosong. Bug ini sudah ada sejak fitur peta; ditemukan lewat uji browser otomatis (Playwright + geolokasi tiruan).

- Koordinat kini input **terkontrol** dari state pin; form diberi tahu (`change`) setelah render sehingga estimasi ongkir & tombol kirim ikut diperbarui.
- **Satu kolom lokasi** (permintaan pemilik): kolom alamat dan kotak "Cari alamat" peta digabung. `LocationPicker` dengan `addressName="location"` merender kolom alamat wajib yang sekaligus pencarian; Enter/"Cari" → pilih hasil mengisi alamat & titik bersama; mengetik alamat lalu pindah kolom menaruh titik di hasil teratas (nama tempat yang diketik dipertahankan); "Lokasi saya"/ketuk/geser mengisi alamat dari titik kecuali pengguna sudah mengetik sendiri. Dipakai di halaman vendor, "Buat acara", dan "Catat pesanan offline" (kolom teks lokasi terpisah dihapus).

**Verifikasi (browser, lokal)**: Lokasi saya, ketik+pindah kolom, cari+pilih, dan ketuk peta semuanya mengisi alamat **dan** titik, kota Surabaya terpilih, tombol kirim aktif; estimasi ongkir ±5,1 km Rp27.000; permintaan terkirim ke `/quotations/…`; "Buat acara" hanya punya satu kolom lokasi dan menyimpan titik. Typecheck, lint, 142 unit test lulus.

## v0.16.2 — Lokasi pemesanan seragam (10 Nov 2026)

**Bug**: di halaman vendor, "Lokasi saya", ketuk peta, atau geser pin hanya mengubah koordinat; kolom wajib "Lokasi acara" tetap kosong sehingga permintaan tidak bisa dikirim. Kolom hanya terisi saat memilih hasil pencarian alamat. Selain itu, "Buat acara" masih teks biasa tanpa peta, dan acara tersimpan tidak pernah tersambung ke permintaan: halaman vendor meminta lokasi ulang lalu backend membuat acara baru "Pesanan {paket}" bertipe Lainnya, sehingga vendor tidak melihat nama, tipe, dan catatan acara yang diisi pelanggan.

**Perbaikan**
- `LocationPicker`: setiap kali pin ditaruh (GPS, ketuk, geser, hasil pencarian) alamat dicari dari koordinat (Nominatim *reverse*) dan mengisi kolom lokasi; opsi `cityInputName` memilih kota (Surabaya/Sidoarjo/Gresik) yang disebut alamat. Teks yang diketik sendiri tidak ditimpa; hanya hasil reverse terbaru yang dipakai. Dipakai di halaman vendor, "Buat acara", dan "Catat pesanan offline".
- **Buat acara** kini memakai peta yang sama; koordinat disimpan ke acara (`eventSchema` menerima `latitude`/`longitude`, wajib berpasangan).
- **Acara tersimpan → katalog → vendor**: `eventId` dan titik acara ikut dibawa. Halaman vendor menampilkan ringkasan "Untuk acara tersimpan" (nama, tanggal, jam, pax), alamat & pin terisi dari acara dan tetap bisa disesuaikan. Permintaan memakai acara tersebut; alamat, kota, dan titik yang dikonfirmasi ikut memperbarui acara.
- Hasil: kedua jalur menghasilkan data yang sama untuk vendor (nama & tipe acara, tanggal, jam, pax, alamat, kota, titik, jarak, ongkir).

**Verifikasi** (lokal): reverse geocoding mengembalikan alamat & kota; acara dibuat dengan koordinat; halaman vendor mode acara terisi; permintaan lewat formulir web memakai acara yang sama (nama, tipe BIRTHDAY, alamat & titik terbaru, jarak 4,4 km, ongkir Rp23.000); pesanan langsung menyimpan alamat & titik (5,1 km, Rp27.000); typecheck, lint, 142 unit test lulus.

## v0.16.1 — Rapikan tampilan & ikon (10 Nov 2026)

- **Ikon CaterHub**: tudung saji (cloche) hitam di kotak kuning dengan kenop jeruk (mengulang titik pada wordmark). Favicon `frontend/src/app/icon.svg`, ikon iOS `apple-icon.png` (180 px); komponen `LogoMark` tampil di samping wordmark di navbar, halaman login, footer, dan invoice (`<Logo mark={false} />` untuk wordmark saja).
- **Tanpa simbol abstrak di menu**: ikon glyph (◈ ▣ ✎ ◫ …) dihapus dari menu samping vendor/admin dan kartu KPI dashboard pelanggan, vendor, admin. Bintang rating (★) dan ikon tipe notifikasi tetap karena bermakna.
- **Kredensial demo tidak lagi tampil di halaman login**; seluruh akun demo (admin, 4 pelanggan, 5 vendor) dan bagian **Demo live** kini ada di README.
- **Em-dash dikurangi**: ±90 em-dash di teks yang tampil (landing page, dashboard, formulir, pesan status, notifikasi & WhatsApp dari backend, deskripsi vendor seed) diparafrase menjadi titik, koma, titik dua, atau tanda kurung; pemisah "Acara — Vendor" menjadi "Acara · Vendor". Tanda tangan WhatsApp kini "Salam, CaterHub". Yang tersisa hanya "—" sebagai penanda nilai kosong di tabel dan komentar kode.

**Verifikasi**: typecheck & lint bersih, 142 unit test lulus, `next build` sukses (ikon terdaftar sebagai `/icon.svg` & `/apple-icon.png`).

## v0.16.0 — Persiapan pengumpulan & video demo (10 Nov 2026)

Batas pengumpulan 10 Nov; uji juri penyisihan 10–14 Nov; final 14 Nov.

- **Progres vendor mulai H-1**: "Berangkat antar" dan "Tandai selesai" ditolak API (`409 TOO_EARLY`, pesan berisi tanggal buka) bila hari ini (WIB) sebelum H-1 acara — mencegah pesanan ditandai selesai jauh sebelum acaranya. Halaman **Pesanan** menampilkan keterangan "tersedia mulai H-1 (tanggal)"; tombol di **Produksi** baru muncul mulai H-1. Helper `canVendorAdvance`/`vendorAdvanceOpensOn` di backend & frontend, +3 test.
- **Label sandbox di halaman bayar**: bila tagihan berasal dari Midtrans sandbox (URL Snap `sandbox.midtrans.com`), tampil kotak "Mode uji (sandbox Midtrans) — tidak ada uang sungguhan", cara bayar lewat simulator, dan tautan **QRIS Simulator Midtrans**. Otomatis hilang di production.
- **Foto vendor demo**: 32 foto Wikimedia Commons berlisensi bebas di `backend/prisma/seed-assets/` (logo & cover 5 vendor, 20 menu, 2 paket; di-crop & dikecilkan, total ±3 MB). Seed menyalinnya ke `PUBLIC_UPLOAD_DIR/seed/` (volume di produksi) dan mengisi `logoUrl`, `coverUrl`, `imageUrl` menu & paket — juga untuk data yang sudah ada. Foto dipilih manual: yang memuat wajah atau logo merek diganti/di-crop. Kredit lengkap di [ASSET_CREDITS.md](./ASSET_CREDITS.md).
- **DEMO_SCRIPT** diperbarui untuk versi live: URL produksi, seed via `railway ssh`, bayar lewat Midtrans + simulator, WA sungguhan ke HP vendor, aturan H-1, langkah cadangan (mock) bila provider bermasalah.

- **Email "Deployment crashed" di setiap deploy**: penyebabnya start command lewat dua lapis `npm`, yang keluar dengan status gagal (`npm error signal SIGTERM`) saat Railway menghentikan container lama. Start command service diganti menjalankan Node langsung — `api`: `node --import tsx backend/src/index.ts`, `web`: `node node_modules/next/dist/bin/next start frontend` — sehingga SIGTERM ditangani handler shutdown dan proses keluar 0. Berlaku mulai deploy dari source berikutnya.

**Verifikasi**: seed lokal sukses (32 foto tersalin); katalog lokal memuat 5 cover + 5 logo, halaman vendor memuat 24 foto, `/uploads/seed/*` tersaji lewat web (200 image/jpeg).

## v0.15.0 — Fase 2 Tahap D: WhatsApp via Fonnte (10 Nov 2026)

**Keputusan**: WA sungguhan hanya untuk **vendor demo** (Dapur Nusantara, `vendor1@demo.id`); pelanggan tetap lewat kotak keluar. Nomor **pengirim** (device Fonnte) dan **penerima** (vendor demo) dibedakan; risiko pemblokiran WhatsApp ada di sisi pengirim, jadi pengirim memakai nomor cadangan.

**Hasil uji di produksi**: pesan uji langsung via Fonnte diterima; setelah seed ulang, Sari membayar "Arisan Keluarga Wijaya" lewat QRIS simulator Midtrans → WA "Pembayaran lunas diterima" masuk ke HP vendor demo (kotak keluar: `SENT`, provider `fonnte`). Pesan berprovider `mock` di kotak keluar adalah contoh dari seed.

- **Provider Fonnte** (`backend/src/domain/whatsapp.ts`): `POST https://api.fonnte.com/send` (`target`, `message`, `countryCode=62`, header `Authorization: FONNTE_TOKEN`), timeout 15 dtk; alasan gagal dari Fonnte (mis. device terputus, kuota) dicatat di kotak keluar; dicoba ulang maks. 3× oleh dispatcher yang sudah ada.
- **Saklar** `WHATSAPP_PROVIDER=mock|fonnte` (default mock; mock tetap cadangan).
- **Pengaman nomor demo**: data seed berisi nomor karangan yang bisa saja milik orang sungguhan, jadi provider asli hanya mengirim ke `WHATSAPP_ALLOWED_NUMBERS` (fallback `DEMO_VENDOR_WHATSAPP`; `*` = semua; kosong = tidak ada). Nomor lain → status **Dilewati** dengan alasan.
- **Seed**: nomor usaha Dapur Nusantara diambil dari `DEMO_VENDOR_WHATSAPP` bila diisi, sehingga tetap benar setelah seed ulang di hari demo.
- **Kotak keluar admin** menampilkan provider yang aktif (sebelumnya selalu "mock") dan penjelasan sesuai mode.

**Verifikasi**: 8 test baru (`whatsapp-fonnte.test.ts`: saklar provider, pengaman nomor, format request Fonnte, alasan gagal, token kosong, error jaringan) — total 139 unit test lulus (backend 104, frontend 35), typecheck & lint bersih.

## v0.14.0 — Fase 2 Tahap C: Midtrans sandbox (10 Nov 2026)

**Hasil uji end-to-end di produksi (sandbox)**: dua pesanan demo dibayar lewat QRIS simulator Midtrans — `Arisan Keluarga Wijaya` (Rp2.775.000) dan `Pernikahan Budi & Sari` (Rp9.781.000): Snap terbuka dengan QRIS, notifikasi Midtrans diverifikasi lewat status API, payment → `SETTLEMENT`, booking → `PAID`, notifikasi "Pembayaran diterima" (pelanggan) & "Pembayaran lunas diterima" (vendor) terkirim, halaman bayar memperbarui diri otomatis.

**Perbaikan integrasi Snap** (`backend/src/domain/payment.ts`)
- Parameter QRIS: `payment_type: "qris"` (parameter Core API, diabaikan Snap) diganti `enabled_payments: ["other_qris"]`; bisa diubah lewat `MIDTRANS_ENABLED_PAYMENTS`.
- `gross_amount` dibulatkan ke Rupiah; `callbacks.finish` mengarahkan pelanggan kembali ke `/bookings/:id`.
- URL webhook dikirim per transaksi lewat header `X-Override-Notification` = `APP_URL/api/payments/webhook` (hanya bila `APP_URL` https) → tidak perlu mengatur Notification URL di dashboard Midtrans. Webhook masuk lewat `web` lalu diteruskan ke API lewat jaringan privat, jadi `api` tetap tanpa domain publik.
- Error Snap kini dicatat di log API (status + pesan Midtrans) untuk diagnosis; pelanggan melihat `502 PAYMENT_PROVIDER_ERROR` "Layanan pembayaran sedang bermasalah. Coba lagi beberapa saat lagi." (sebelumnya 500 generik). Tagihan tidak tersimpan bila Snap gagal.

**Verifikasi webhook lewat status Midtrans** (temuan uji sandbox): notifikasi asli Midtrans untuk akun dengan server key yang di-*generate* (berizin) **ditandatangani memakai key lain**, sehingga cek signature selalu gagal (`400 Signature webhook tidak valid`, payload & nominal sebenarnya benar). Kini bila signature tidak cocok, API memanggil `GET /v2/{order_id}/status` dan memakai **status & nominal dari Midtrans**, bukan isi payload — webhook palsu hanya memicu pengecekan yang mengembalikan status asli. Butuh izin **Core API: Read** pada server key. Alasan penolakan webhook kini dicatat di log (order, status, nominal, field).

**Keamanan webhook** (`backend/src/domain/payment-apply.ts`)
- **Cek nominal**: settlement dengan `gross_amount` ≠ tagihan **tidak dilunaskan**; admin mendapat notifikasi "Nominal pembayaran tidak cocok". `gross_amount` non-angka ditolak.
- Order tidak dikenal (mis. tombol "test notification" Midtrans) → `200 { ignored: true }`, bukan 500 yang memicu pengiriman ulang.

**Halaman bayar**: mode Midtrans menampilkan tombol "Bayar QRIS via Midtrans" dan langkah yang sesuai (QR di halaman membuka halaman Snap); mode mock tidak berubah.

**Konfigurasi**: `.env.example` — tambah `MIDTRANS_ENABLED_PAYMENTS`; hapus `MIDTRANS_CLIENT_KEY` & `MIDTRANS_WEBHOOK_SECRET` yang tidak dipakai kode (signature webhook memakai server key).

**Verifikasi**: 12 test baru di `payment.test.ts` (parameter Snap, override webhook, kanal env, error Snap, nominal webhook, verifikasi via status Midtrans) — total 131 unit test lulus (backend 96, frontend 35), typecheck & lint bersih. Uji end-to-end sandbox menyusul setelah server key tersedia.

## v0.13.0 — Fase 2 Tahap B: siap deploy Railway (9 Nov 2026)

**Keputusan**: platform **Railway** (trial 30 hari + kredit US$5 cukup untuk demo ±16 Nov). Render gratis ditolak karena service tidur setelah 15 menit (penjadwal ikut berhenti), disk tidak persisten (unggahan hilang), dan Postgres gratis kedaluwarsa 30 hari.

**Perubahan kode**
- API membaca `PORT` dari platform, fallback `API_PORT` lalu 4000 (`backend/src/env.ts`).
- `tsx` dan `prisma` dipindah ke `dependencies` backend agar start & migrasi tetap jalan bila builder memangkas dev deps.
- Script baru `npm run db:deploy` (`prisma migrate deploy`); `engines.node = 22.x` di `package.json` root.
- Sempat ditambahkan `backend/railway.json` & `frontend/railway.json`, lalu **dihapus**: Railway kini menolak Config as Code (deprecated, diganti IaC `.railway/railway.ts`). Pengaturan build/deploy dipasang langsung di service (disetujui): build + typecheck, pre-deploy migrasi, start, healthcheck `/health` & `/login`, restart on failure, watch path per folder agar perubahan frontend tidak me-redeploy API dan sebaliknya.

**Infrastruktur Railway** (dibuat via CLI): project `caterhub`, region Singapore — `Postgres`, `api` (volume `/data` 500 MB, domain privat `api.railway.internal`), `web` (domain publik `https://web-production-240c4.up.railway.app`); variabel produksi terisi kecuali `AUTH_SECRET` (diisi pemilik).

**Dokumentasi**: `docs/DEPLOY.md`: arsitektur 3 service, tabel pengaturan build/deploy, langkah setup via CLI, tabel variabel produksi, seed via `railway ssh`, checklist verifikasi, troubleshooting. README bagian Deployment diperbarui.

**Verifikasi lokal**: typecheck backend bersih, 84 unit test backend lulus, API start dengan `NODE_ENV=production PORT=4321` dan `/health` merespons, `db:deploy` sukses ("No pending migrations").

**Verifikasi produksi** (live di **https://web-production-240c4.up.railway.app**): build & deploy `api` dan `web` sukses; 14 migrasi diterapkan lewat pre-deploy; seed demo via SSH; login 3 akun demo 200 dengan cookie `Secure`; halaman vendor di URL publik menampilkan data seed; rate limit login → 429 pada percobaan ke-11; file di volume `/data` bertahan setelah redeploy `api`. Detail di [DEPLOY.md](./DEPLOY.md#verifikasi-definisi-selesai-tahap-b).

## v0.12.0 — Fase 2 Tahap A: smoke test, keamanan login, tampilan mobile (9 Nov 2026)

Tahap pertama Fase 2 (hackathon): merapikan Fase 1 sebelum integrasi nyata.

**A1 — Smoke test E2E di repo**
- `backend/scripts/smoke.ts`, dijalankan dengan `npm run test:smoke` dari root (API harus hidup di `http://localhost:4000`, bisa diganti `SMOKE_API_URL`). Skrip memakai akun demo, **mengubah data**, lalu otomatis menjalankan `db:seed` untuk mengembalikan data demo.
- 6 bagian, 24 cek: bayar → invoice; batal/refund/kedaluwarsa; negosiasi + menu tambahan + di luar jangkauan ongkir; dapur (resep/HPP), pesanan offline & progres otomatis (waktu disimulasikan lewat fungsi domain); notifikasi & kotak keluar WhatsApp; keamanan sesi. Hasil terakhir: **24 lulus, 0 gagal**.

**A2 — Keamanan login (GAP C1–C3)**
- **Batas percobaan** (`backend/src/lib/rate-limit.ts`, sliding window di memori): login gagal 10×/15 menit per email → `429 RATE_LIMITED` ("Coba lagi dalam N menit"), berhasil login mereset hitungan; pendaftaran 20/jam; chat penawaran 30 pesan/menit per pengguna. Akun placeholder (pelanggan offline) tidak bisa login.
- **Sesi**: umur JWT 30 → **7 hari**; kolom baru `User.tokenVersion` (migrasi `20261108184355_session_token_version`) ikut di token (`tv`) dan dicocokkan dengan database di setiap request — **ganti sandi mencabut semua sesi lain**, perangkat yang mengganti sandi mendapat cookie baru (diteruskan BFF Next ke browser). Perubahan peran juga membatalkan sesi lama.
- Frontend: halaman yang memuat data dengan sesi dicabut/kedaluwarsa diarahkan ke `/login` dengan pesan "Sesi Anda berakhir", bukan halaman error.
- **Sandi minimal 8** di daftar, ganti sandi, dan validasi frontend (sebelumnya 6 vs 8).

**A3 — Tampilan mobile halaman vendor** (diperiksa via emulasi 390 px: Pesanan, Lembar Produksi, Catat pesanan offline, Bahan & HPP; tidak ada scroll horizontal)
- Navbar: label "Dasbor Vendor/Admin" disingkat "Dasbor" di layar sempit agar tidak terlipat dua baris.
- Navigasi pil vendor/admin: pil pertama kini sejajar margin (sebelumnya snap menempel ke tepi layar) — `scroll-padding`.
- Bahan & HPP: tab tidak lagi terlipat (satu baris, bisa digeser); angka margin rata kiri saat kartu sempit.
- Peta titik antar: kolom "Cari alamat" mendapat satu baris penuh di ponsel (sebelumnya terpotong).

**Verifikasi**: 119 unit test (backend 84 termasuk `rate-limit.test.ts`, frontend 35), typecheck & lint bersih, smoke test 24/24, uji keamanan sesi 7/7, screenshot mobile sebelum/sesudah.

## v0.11.0 — Lokasi & ongkir otomatis (9 Nov 2026)

**Masalah**: ongkir diketik manual oleh vendor di setiap pesanan — lambat, tidak konsisten, dan pelanggan baru tahu ongkir setelah konfirmasi.

**Keputusan** (disetujui): tarif **dasar + per km** (tarif dasar menanggung N km pertama, sisa km dibulatkan ke atas, radius maksimal); jarak = **garis lurus × 1,3** (perkiraan jalan, tanpa API); input lokasi lewat **peta Leaflet + OpenStreetMap + GPS + pencarian alamat (Nominatim)**; ongkir **terisi otomatis tetapi bisa diubah** vendor, perubahan tercatat.

**Fitur**
- **Profil usaha → Lokasi dapur & tarif ongkir**: pin dapur di peta, tarif dasar, jarak tarif dasar, per km, radius maks., plus tabel contoh (±2/5/10/20 km).
- **Form pesanan pelanggan**: peta "Titik antar" (wajib bila vendor sudah memasang lokasi) menampilkan dapur & titik antar; estimasi kini **Subtotal + Ongkir (±x km) = Estimasi total**; peringatan bila di luar jangkauan. Pencarian alamat mengisi kolom lokasi bila masih kosong.
- **Backend**: permintaan dengan pin menghitung ongkir sesuai tarif → `deliveryFee` & total, menyimpan `distanceKm` + `suggestedDeliveryFee` (snapshot) dan koordinat acara; di luar radius → `400 OUT_OF_DELIVERY_RANGE`. Tanpa pin tetap didukung (ongkir 0, diisi vendor).
- **Konfirmasi vendor**: kolom ongkir terisi dari tarif dengan keterangan jarak; bila diubah → riwayat "Ongkir disesuaikan vendor dari X (tarif ±y km) menjadi Z".
- **Katalog**: tombol **"Dekat lokasi saya"** (GPS) → kartu vendor menampilkan ±km & ongkir ke lokasi Anda; vendor di luar radius ditandai; rekomendasi "Lokasi dekat" kini memakai **jarak nyata** (≤10 km) — sebagian roadmap #6.
- **Pesanan offline**: peta titik antar + kolom ongkir **terisi otomatis** dari tarif (tetap bisa diubah); koordinat & jarak tersimpan.

**Teknis**
- `backend/src/domain/delivery.ts` (`haversineKm`, `roadDistanceKm`, `quoteDelivery`, `quoteDeliveryBetween`) dengan salinan `frontend/src/lib/delivery.ts` untuk estimasi langsung (keduanya diuji dengan kasus yang sama).
- API: `PATCH /api/v1/vendor/me/delivery`; `POST /quotations/request` & `/vendor/bookings/offline` menerima `latitude`/`longitude`; `GET /vendors` menerima `lat`/`lng`; detail vendor memuat lokasi & tarif.
- Migrasi `20261108174858_delivery_fee`: `VendorProfile.deliveryBaseFee/BaseKm/PerKm/MaxKm`, `Event.latitude/longitude`, `Quotation.distanceKm/suggestedDeliveryFee`.
- Komponen baru: `LocationPicker` (Leaflet dimuat dinamis di klien, penanda tanpa gambar), `AutoDeliveryFee`, `DeliverySettings`, `NearMeButton`; `LiveEstimate` kini menghitung ongkir. Dependensi baru: `leaflet` (+ `@types/leaflet`). Tile peta & pencarian alamat memakai layanan publik OSM (perlu internet; atribusi ditampilkan).
- Seed: titik dapur & tarif berbeda untuk 5 vendor, koordinat lokasi acara cerita Dapur Nusantara (permintaan Budi kini memuat ongkir sesuai tarif); teks ulasan seed kini bergiliran (sebelumnya berulang).

**Verifikasi**: 117 unit test (backend 82 termasuk `delivery.test.ts`, frontend 35 termasuk `delivery.test.ts`), typecheck & lint bersih, smoke test E2E 12 cek (validasi tarif, kartu katalog ±6,1 km → Rp31.000, lokasi Malang ±100 km ditolak, snapshot ongkir & koordinat, tanpa pin, penyesuaian ongkir tercatat, offline) lulus; tampilan peta diperiksa via screenshot; data uji dibersihkan dengan seed ulang.

## v0.10.0 — Progres pesanan otomatis (9 Nov 2026)

**Masalah**: setelah lunas, vendor harus menekan 4 tombol per pesanan (*Mulai memasak → Siap kirim → Sudah diantar → Selesai*); di dapur yang sibuk status mudah tertinggal sehingga pelanggan tidak tahu progres dan ulasan tidak terpicu.

**Keputusan** (disetujui): otomatis + konfirmasi pelanggan; mulai masak otomatis **00:00 WIB hari acara**; tahap *Siap kirim* **digabung** ke *Sedang diantar*.

| Transisi | Sekarang |
|---|---|
| Lunas → Dimasak | **Otomatis** 00:00 WIB hari acara + ringkasan pagi ke vendor (app + WA: "N pesanan, X porsi masuk tahap masak"); atau **Mulai masak semua** di Lembar Produksi untuk memasak lebih awal |
| Dimasak → Sedang diantar | **1 klik "Berangkat antar"** (Lembar Produksi / daftar pesanan), mencatat `departedAt` + WA ke pelanggan berisi tautan konfirmasi |
| Sedang diantar → Selesai | Pelanggan **"Ya, pesanan sudah diterima"** (`receivedAt`, `completedBy=CUSTOMER`) → langsung bisa memberi ulasan; atau **otomatis 24 jam setelah jam acara** (`completedBy=SYSTEM`) + ajakan ulasan |
| Pengaman | Jam acara lewat & belum berangkat → **pengingat sekali** ke vendor (app + WA). Pelanggan boleh konfirmasi sejak hari acara walau vendor lupa klik. Pesanan offline selesai otomatis tanpa notifikasi ke placeholder. "Tandai selesai" manual tetap ada untuk koreksi |

Klik vendor per pesanan: **4 → 0–1**.

**Teknis**
- `backend/src/domain/progress.ts`: `eventStartAt` (jam acara WIB → instant; format "10:00", "10.00–14.00", default 12:00), `canConfirmReceipt`, `markDeparted`, `confirmReceipt`, `startCookingForDate`, `autoStartCooking`, `remindLateDelivery`, `autoCompleteBookings` — dijalankan penjadwal 5 menit (`expiry.ts`) dengan klaim baris anti-dobel.
- Transisi baru `PAID/PREPARING → DELIVERED`; advance vendor ke `DELIVERED` memakai `markDeparted`.
- API: `POST /api/v1/bookings/:id/received` (pelanggan), `POST /api/v1/vendor/production/start` (`{ date }`).
- Migrasi `20261108172310_auto_progress`: `Booking.departedAt`, `receivedAt`, `completedBy`, `lateReminderSentAt`.
- UI: stepper *Permintaan → Pembayaran → Lunas → Dimasak → Diantar → Selesai*; label `DELIVERED` = "Sedang diantar"; kartu **"Pesanan sudah sampai?"** di detail pesanan pelanggan; petunjuk progres per status di daftar pesanan vendor; banner **Mulai masak semua** + tombol **Berangkat antar** per pesanan di Lembar Produksi (pesanan yang sedang diantar tetap tampil di lembar hari itu).
- Seed: "Pengajian Bulanan" kini **sedang diantar hari ini** untuk demo konfirmasi penerimaan oleh Budi.

**Verifikasi**: 109 unit test (backend 76 termasuk `progress.test.ts`, frontend 33), typecheck & lint bersih, smoke test E2E 14 cek (masak otomatis + ringkasan, pengingat telat sekali, berangkat antar + WA, konfirmasi terima → ulasan, akses ditolak untuk pelanggan lain, selesai otomatis 23 j vs 25 j, mulai masak semua, konfirmasi terlalu dini ditolak, offline tanpa notifikasi) lulus; data uji dibersihkan dengan seed ulang; tampilan diperiksa via screenshot.

## v0.9.0 — Seed demo bercerita + skrip demo (7 Nov 2026) — sisa Fase 0 selesai

**Seed baru** (`backend/prisma/seed.ts`, `npm run db:seed`)
- **Reset aman & idempoten**: menghapus hanya data transaksi akun demo (pesanan, penawaran, pembayaran, ulasan, notifikasi, WA, kapasitas, penghitung invoice, placeholder offline) lalu membuat ulang **relatif terhadap hari ini**. Katalog menu/paket dan gambar yang sudah ada dipertahankan. Menolak berjalan di production kecuali `ALLOW_DEMO_SEED=true`. Diverifikasi dua kali berturut-turut menghasilkan data identik. Data uji dari pengembangan Fase 1 ikut terhapus (sesuai keputusan).
- **Cerita Dapur Nusantara**: 18 bahan baku + resep lengkap untuk 20 menu (HPP & margin tanpa "belum lengkap"); permintaan baru (Budi, pernikahan 250 pax), penawaran khusus menunggu keputusan (Andi), revisi diminta (PT Maju Jaya), pesanan menunggu bayar dengan batas waktu berjalan (Sari), **hari produksi H+3** (pesanan lunas online + offline lunas tunai + offline tentatif), pesanan sedang dimasak (besok), refund menunggu admin; riwayat 6 bulan dengan ulasan untuk analitik.
- Vendor lain mendapat riwayat & ulasan; semua pesanan bernomor invoice berurutan; kapasitas dihitung ulang dari pesanan aktif.
- Notifikasi belum dibaca & **Kotak keluar WA** terisi pesan terkirim yang sesuai cerita. Pelanggan demo kini punya nomor telepon & alamat.
- `backend/tsconfig.json` kini ikut memeriksa `prisma/**/*.ts`.

**Skrip demo** — [DEMO_SCRIPT.md](./DEMO_SCRIPT.md): persiapan 3 jendela (pelanggan/vendor/admin), alur ±8 menit (temukan → negosiasi → bayar & kuitansi → dapur & HPP → pesanan offline → WA & refund), jawaban pertanyaan teknis, dan pemulihan cepat.

**Catatan**: margin paket Premium hasil seed ±30% (sehat) karena isi paket di database; skrip demo memakai skenario "harga daging sapi naik" untuk memperlihatkan HPP yang hidup, bukan angka yang dipaksakan.

## v0.8.0 — Fase 1 · Tahap 4: Invoice + pesanan offline (7 Nov 2026) — Fase 1 selesai

**Keputusan** (disetujui): invoice berupa **halaman cetak** (Simpan sebagai PDF bawaan browser, tanpa dependensi baru); **nomor invoice terbit saat pesanan dibuat**, berurutan per vendor per tahun, dan dokumen berubah menjadi **kuitansi bercap LUNAS** setelah dibayar; pesanan offline disimpan **satu alur dengan booking** (sumber `OFFLINE` + akun pelanggan placeholder tersembunyi per vendor); vendor boleh mencatat **pembayaran manual hanya untuk pesanan offline**.

**Invoice / kuitansi**
- Nomor `INV/<inisial usaha>/<tahun WIB>/<urut 4 digit>` (cth. `INV/DN/2026/0007`) dari `InvoiceCounter` yang diinkremen atomik (`INSERT … ON CONFLICT … RETURNING`) — aman untuk pesanan bersamaan. Diterbitkan di konfirmasi vendor, penerimaan penawaran, dan pesanan offline; booking lama mendapat nomor saat invoice pertama kali dibuka (idempoten).
- `GET /api/v1/bookings/:id/invoice` (pelanggan pemilik, vendor, admin).
- Halaman `/bookings/[id]/invoice`: kop vendor, pihak ditagih (nama/nomor offline bila pesanan offline), acara, rincian item, biaya, total, dibayar/sisa, riwayat pembayaran, cap **LUNAS / BELUM LUNAS / DIBATALKAN**, tombol **Cetak / Unduh PDF**; aturan cetak A4. Tautan dari detail pesanan dan daftar pesanan vendor.

**Pesanan offline**
- `/vendor/orders/new` — form pelanggan (nama, WA opsional), acara, paket + menu tambahan, ongkir/biaya/diskon, catatan, status bayar (belum / tunai / transfer) dengan estimasi langsung.
- `POST /api/v1/vendor/bookings/offline` (`modules/offline.ts`, `createOfflineBooking`): booking `source=OFFLINE`, quotation `origin=VENDOR_OFFLINE` (ACCEPTED), **memotong kapasitas** (ditolak bila penuh), tanpa batas bayar otomatis, nomor invoice, pembayaran manual bila langsung lunas.
- `POST /api/v1/vendor/bookings/:id/manual-payment` — pelunasan tunai/transfer (ditolak untuk pesanan online).
- Pembatalan pesanan offline yang lunas → `CANCELLED` (tanpa refund via admin; vendor mengembalikan dana langsung).
- Akun placeholder: tidak tampil di daftar/hitungan pengguna admin, tidak menerima notifikasi/WA. Pesanan offline otomatis ikut kalender, lembar produksi (dengan nama & nomor asli), analitik, dan invoice.
- Daftar pesanan vendor: tombol **Catat pesanan offline**, badge OFFLINE, nomor invoice, form **Tandai lunas**; detail pesanan menampilkan pelanggan offline.

**Data (migrasi `20261107123000_fase1_invoice_offline`)**: enum `QuotationOrigin.VENDOR_OFFLINE`; `Booking.invoiceNumber` (unik), `source`, `offlineCustomerName`, `offlineCustomerPhone`; `User.isPlaceholder`; tabel `InvoiceCounter`. Migrasi dibuat dengan `prisma migrate diff` + `migrate deploy` karena `migrate dev` meminta konfirmasi interaktif untuk unique index baru (kolom masih kosong, aman).

**Verifikasi**: 101 unit test (backend 68 termasuk `invoice.test.ts`, frontend 33), typecheck & lint bersih, smoke test E2E 17 cek (nomor berurutan, akses invoice, kuitansi lunas, nomor booking lama idempoten, offline → kapasitas/produksi/invoice/placeholder, pelunasan manual, kapasitas penuh, batal offline) lulus, tampilan diperiksa via screenshot.

**Catatan**: nomor invoice `0001`–`0007` milik vendor demo `Dapur Nusantara` terpakai oleh data uji yang sudah dibatalkan (nomor tidak didaur ulang, seperti praktik pembukuan pada umumnya).

## v0.7.0 — Fase 1 · Tahap 3: Notifikasi WhatsApp (mock) (7 Nov 2026)

**Keputusan** (disetujui): provider **mock** dulu; pesan ditampilkan di halaman admin **Kotak keluar WA**; WhatsApp hanya untuk **event penting**; nomor diambil dari profil dengan **pengaturan aktif/nonaktif** per pengguna (default aktif); **pengingat ±3 jam** sebelum batas bayar.

**Arsitektur — transactional outbox** (`backend/src/domain/whatsapp.ts`, `notify.ts`)
- `notify(tx, userId, { …, whatsapp: true })` menulis notifikasi aplikasi **dan** baris `WhatsAppMessage` dalam transaksi yang sama (bila transaksi batal, WA juga tidak terkirim).
- Penerima: vendor memakai nomor usaha lalu nomor akun; pelanggan memakai nomor akun. Nomor dinormalkan ke `62…`; opt-out, nomor kosong, atau tidak valid → status `SKIPPED` dengan alasan (terlihat di kotak keluar).
- `dispatchWhatsApp()` mengirim antrean `QUEUED` lewat `WhatsAppProvider` (klaim baris anti-dobel, maks. 3 percobaan → `FAILED`), berjalan tiap 5 detik dari `index.ts`. Provider asli cukup menambah kelas baru di `getWhatsAppProvider()`.

**Event WhatsApp**
| Penerima | Event |
|---|---|
| Vendor | Permintaan pesanan baru · penawaran diterima pelanggan · pelanggan minta revisi · **pembayaran lunas** (baru) · pembatalan |
| Pelanggan | Pesanan dikonfirmasi · penawaran khusus masuk/diperbarui · **pengingat batas bayar** (baru) · pembatalan · refund (pembayaran telat & refund selesai) |

Chat, ulasan, verifikasi, kedaluwarsa, dan notifikasi admin tetap hanya di aplikasi. Pelanggan kini juga mendapat notifikasi aplikasi "Pembayaran diterima".

**Data (migrasi `20261107120618_fase1_whatsapp_outbox`)**: `User.whatsappOptIn`, `Booking.paymentReminderSentAt`, tabel `WhatsAppMessage`.

**API**: `PATCH /api/v1/me/whatsapp` (semua peran), `GET /api/v1/me` kini memuat `whatsappOptIn`, `GET /api/v1/admin/whatsapp` (kotak keluar + hitungan status; memicu dispatcher). Env baru `WHATSAPP_PROVIDER="mock"`.

**UI**: kartu **Notifikasi WhatsApp** di profil pelanggan & profil usaha vendor (status, nomor yang dipakai, validasi, tombol aktif/nonaktif); halaman admin **Kotak keluar WA** bergaya layar WhatsApp (daftar penerima, gelembung pesan, ✓✓ terkirim, alasan bila dilewati, auto-refresh 5 detik).

**Verifikasi**: 96 unit test (backend 63 termasuk `whatsapp.test.ts`, frontend 33), typecheck & lint bersih, smoke test E2E 10 cek (antre → terkirim, chat tanpa WA, opt-out → SKIPPED, pengingat sekali, lunas → vendor saja, pembatalan & refund → pelanggan) lulus dengan data uji dibersihkan, tampilan diperiksa via screenshot.

## v0.6.0 — Fase 1 · Tahap 2: Lembar produksi dapur + HPP (7 Nov 2026)

**Keputusan desain** (disetujui): resep dicatat **per menu** (bahan per porsi; HPP paket = jumlah HPP menu di dalamnya); HPP = bahan baku + satu angka **biaya lain per porsi** per paket (kemasan, gas, tenaga); lembar produksi memakai pesanan **lunas** (PAID/PREPARING/READY) dengan pesanan belum bayar ditampilkan terpisah sebagai **tentatif**.

**Data (migrasi `20261107115456_fase1_costing_production`)**
- `Ingredient` (nama unik per vendor, satuan beli `kg`/`liter`/`pcs`, harga per satuan).
- `MenuItemIngredient` (resep: jumlah per porsi dalam g/ml/pcs).
- `Package.otherCostPerPax`.
- `QuotationItem.menuItemId` (opsional) — menu tambahan & baris penawaran yang tertaut menu ikut terhitung di produksi; `OfferEditor` mempertahankan tautan ini saat vendor mengubah penawaran.

**API baru** (`backend/src/modules/kitchen.ts`, semua di `/api/v1/vendor`, khusus vendor pemilik)
- `GET/POST /ingredients`, `DELETE /ingredients/:id` — duplikat nama (tanpa beda huruf besar) ditolak.
- `PUT /menu/:id/recipe` — ganti resep; bahan milik vendor lain ditolak.
- `GET /costing` — HPP per menu, HPP & margin per paket, daftar menu tanpa resep.
- `PATCH /packages/:id/cost` — biaya lain per porsi.
- `GET /production?date=YYYY-MM-DD` — porsi per menu, daftar belanja (jumlah satuan beli + estimasi biaya), jadwal kirim, bagian tentatif, dan tanggal mendatang yang punya pesanan.
- Logika murni di `backend/src/domain/costing.ts` (`ingredientCost`, `menuCostPerPortion`, `packageCosting`, `aggregateProduction`).

**UI vendor**
- **Bahan & HPP** (`/vendor/costing`): tab *Paket & margin* (bar HPP vs harga, margin Rp & %, label Sehat/Tipis/Rugi; "Belum lengkap" + tanda ≤ bila ada menu tanpa resep), *Resep menu* (`RecipeEditor`: satuan otomatis g/ml/pcs, biaya per baris & HPP per porsi langsung), *Bahan baku* (tambah/ubah/hapus).
- **Produksi** (`/vendor/production`): pilih tanggal / chip jadwal mendatang, ringkasan (pesanan, porsi, estimasi belanja), porsi per menu per kategori, daftar belanja dengan kotak centang, jadwal kirim (jam, lokasi, kontak, paket & tambahan), bagian tentatif, peringatan menu tanpa resep, tombol **Cetak lembar** (navbar & sidebar disembunyikan saat dicetak).

**Verifikasi**: 90 unit test (backend 57 termasuk `costing.test.ts`, frontend 33), typecheck & lint bersih, smoke test E2E 10 cek (bahan → resep → HPP → pesanan lunas+tentatif → lembar produksi → tautan menu bertahan) lulus dengan data uji dibersihkan, tampilan diperiksa via screenshot.

## v0.5.0 — Fase 1 · Tahap 1: Negosiasi & kustomisasi menu (7 Nov 2026)

**Fitur**
- **Menu tambahan saat memesan.** Form pesanan di detail vendor kini menampilkan menu ber-harga add-on (> Rp0) sebagai pilihan per pax, dengan **estimasi subtotal langsung** (`LiveEstimate`). Backend memvalidasi menu milik vendor & masih tersedia, lalu menambahkan baris `Tambahan: …` ke nota (`buildRequestItems`).
- **Penawaran khusus vendor.** Selain "Konfirmasi langsung", vendor bisa mengubah item/harga, menambah baris, mengatur ongkir/biaya/diskon, catatan, dan masa berlaku (1/3/7 hari) lewat `OfferEditor`, lalu mengirimnya ke pelanggan (`REQUESTED → SENT`). Penawaran yang sudah terkirim tetap bisa diubah.
- **Keputusan pelanggan.** Di halaman penawaran pelanggan bisa **Terima & lanjut bayar** (membuat booking + mengunci kapasitas), **Minta revisi** (catatan wajib), atau **Tolak** (alasan opsional, dengan konfirmasi).
- **Siklus revisi.** `REVISION_REQUESTED` muncul di seksi "Revisi diminta" pada daftar vendor dengan tombol "Perbarui penawaran"; revisi terkirim membersihkan catatan revisi lama.
- **Dashboard.** Pelanggan melihat seksi "Penawaran menunggu keputusan Anda"; dashboard vendor menghitung permintaan revisi sebagai tugas tertunda. Daftar vendor dipecah: *Revisi diminta*, *Permintaan baru*, *Menunggu keputusan pelanggan*, *Sudah ditangani*.

**Perbaikan backend**
- Keputusan tolak/revisi kini dalam transaksi dengan klaim optimistik dan **mengirim notifikasi ke vendor** (sebelumnya vendor tidak tahu).
- Pembaruan penawaran dalam transaksi dengan klaim status (tidak menimpa keputusan pelanggan yang masuk bersamaan).
- Validasi: masa berlaku penawaran harus di masa depan; paket pada penawaran harus milik vendor.

**Verifikasi**: 83 unit test (backend 50 termasuk `quotation-request.test.ts`, frontend 33), typecheck & lint bersih, smoke test E2E alur penawaran (9 cek) lulus, tampilan diperiksa via screenshot.

## v0.4.0 — Aset landing page (7 Nov 2026)
- 9 foto Unsplash (hidangan Nusantara, tumpeng, nasi kotak, prasmanan, dapur) di hero, kategori acara, panel UMKM, dan cara kerja; dioptimasi `next/image`. Kredit di [ASSET_CREDITS.md](./ASSET_CREDITS.md).

## v0.3.0 — Redesain UI (7 Nov 2026)
- Bahasa visual baru mengikuti referensi: DM Serif Display + Figtree, kata miring berwarna, CTA pil kuning, panel gradien buah, footer cokelat. Detail di [DESIGN.md](./DESIGN.md).

## v0.2.0 — Fase 0: perbaikan P0 + apple-design (7 Nov 2026)
- Satu tagihan aktif per booking, batas pelunasan + pelepasan kapasitas otomatis, pembatalan & refund, pusat notifikasi, QR asli, reduced-motion. Detail di [GAP_ANALYSIS.md § Status perbaikan P0](./GAP_ANALYSIS.md#status-perbaikan-p0-7-november-2026).

## v0.1.0 — Baseline (commit `73b8d42`)
- Kondisi awal yang dianalisis di [ANALISIS_CODEBASE.md](./ANALISIS_CODEBASE.md).
