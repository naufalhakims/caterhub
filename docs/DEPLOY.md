# Deploy ke Railway

Panduan deploy CaterHub untuk demo hackathon (Fase 2 Tahap B). Platform dipilih **Railway** karena API harus **selalu hidup**: penjadwal (mulai masak 00:00 WIB, kedaluwarsa pembayaran, selesai otomatis 24 jam) dan batas percobaan login berjalan di dalam proses API, dan unggahan butuh disk persisten. Render gratis ditolak karena service tidur setelah 15 menit, disk tidak persisten, dan Postgres gratis kedaluwarsa 30 hari.

> **Secret tidak pernah masuk repo.** `AUTH_SECRET`, key Midtrans, token Fonnte hanya diisi di tab *Variables* Railway.

## Arsitektur

Satu project Railway, region **Southeast Asia (Singapore)**:

| Service | Isi | Domain |
|---|---|---|
| `Postgres` | PostgreSQL terkelola Railway (volume bawaan) | privat `postgres.railway.internal` |
| `api` | Express (`npm run api:start`), **1 replika**, volume `/data` | privat `api.railway.internal:4000` (publik nanti untuk webhook Midtrans, Tahap C) |
| `web` | Next.js (`npm start`) | publik `https://web-production-240c4.up.railway.app` |

Browser hanya berbicara dengan `web`. Next meneruskan permintaan dan cookie ke API lewat jaringan privat Railway (`API_BASE_URL`), termasuk gambar `/uploads/*` (rewrite di `frontend/next.config.mjs`).

Kedua service memakai **root repo** sebagai root directory (npm workspaces + satu `package-lock.json`).

### Pengaturan build & deploy per service

Disimpan **langsung di service Railway** (bukan di repo): `railway.json` (Config as Code) sudah *deprecated* di Railway dan ditolak API-nya; penggantinya, IaC `.railway/railway.ts`, sengaja tidak dipakai untuk hackathon agar sederhana. Bila service dibuat ulang, isi kembali nilai di bawah (dashboard *Settings*, atau `railway api` mutation `serviceInstanceUpdate`).

| | `api` | `web` |
|---|---|---|
| Builder | Railpack (`npm ci` otomatis; `postinstall` → `prisma generate`) | Railpack (`npm ci` otomatis) |
| Build command | `npm run api:typecheck` | `npm -w frontend run build` |
| Pre-deploy | `npm run db:deploy` (`prisma migrate deploy`) | — |
| Start | `node --import tsx backend/src/index.ts` | `node node_modules/next/dist/bin/next start frontend` (membaca `PORT`) |
| Healthcheck (timeout 120 dtk) | `/health` | `/login` |
| Restart | on failure, maks. 10× | on failure, maks. 10× |
| Watch paths | `/backend/**`, `/package.json`, `/package-lock.json` | `/frontend/**`, `/package.json`, `/package-lock.json` |
| Region / replika | Singapore (`asia-southeast1-eqsg3a`) × 1 | Singapore × 1 |

API membaca `PORT` (disuntik Railway) lalu `API_PORT`, default 4000. Node dikunci `22.x` lewat `engines` di `package.json` root.

## Langkah setup (sekali)

Setup awal dilakukan lewat Railway CLI dari root repo (9 Nov 2026). Di Git Bash, set `MSYS_NO_PATHCONV=1` dulu agar nilai seperti `/data/private` tidak diubah menjadi path Windows.

1. `railway init --name caterhub` (membuat project + menautkan folder).
2. `railway add -d postgres`, lalu `railway add -s api` dan `railway add -s web` (service kosong).
3. Region semua service → Singapore, lalu isi pengaturan build & deploy (tabel di atas) lewat mutation `serviceInstanceUpdate`.
4. `railway service link api` → `railway volume add --mount-path /data`.
5. `railway domain --service web` → domain publik.
6. **Variables `api`** (`railway variable set --service api --skip-deploys KEY=VALUE ...`):

   | Variabel | Nilai |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `AUTH_SECRET` | hasil `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`, **diisi sendiri oleh pemilik** (dashboard atau `railway variable set --service api --stdin AUTH_SECRET`) |
   | `APP_URL` | `https://web-production-240c4.up.railway.app` |
   | `CORS_ORIGIN` | `https://web-production-240c4.up.railway.app` |
   | `UPLOAD_DIR` | `/data/private` |
   | `PUBLIC_UPLOAD_DIR` | `/data/public` |
   | `PAYMENT_PROVIDER` | `mock` |
   | `PAYMENT_WINDOW_HOURS` | `24` |
   | `WHATSAPP_PROVIDER` | `mock` |
   | `ALLOW_MOCK_WEBHOOK` | `false` |
   | `ALLOW_DEMO_SEED` | `true` |

7. **Variables `web`:**

   | Variabel | Nilai |
   |---|---|
   | `NODE_ENV` | `production` |
   | `AUTH_SECRET` | `${{api.AUTH_SECRET}}` (referensi, otomatis sama dengan API) |
   | `API_BASE_URL` | `http://api.railway.internal:4000` (ditulis literal: domain privat `api` baru aktif setelah deploy pertama, sedangkan nilai ini ikut dibakukan saat build `web`) |

8. Hubungkan kedua service ke GitHub `naufalhakims/caterhub` branch `main` (`railway service source connect --repo naufalhakims/caterhub --branch main --service <api|web>`). Setiap push ke `main` me-redeploy service yang watch path-nya berubah.
9. Pastikan `api` tetap **1 replika**: rate limit dan penjadwal disimpan di memori proses.

## Seed data demo

Seed menolak berjalan di production kecuali `ALLOW_DEMO_SEED=true`. Jalankan dari dalam container API:

```bash
railway link                    # sekali: pilih project caterhub
railway ssh keys add            # sekali: daftarkan kunci publik ~/.ssh/*.pub
railway ssh --service api       # shell interaktif di container (folder /app)
npm run db:seed
```

Non-interaktif (mis. dari skrip/agent): `railway ssh` gagal dengan `Host key verification failed` bila host belum dikenal. Pakai `ssh` biasa dengan alamat dari `railway ssh config --service api --dry-run`:

```bash
ssh -o StrictHostKeyChecking=accept-new <User>@ssh.railway.com "npm run db:seed"
```

**Jalankan seed ulang pada hari demo**: tanggal pesanan demo dihitung relatif terhadap hari seed dijalankan. Seed mengosongkan data, jadi akun/pesanan yang dibuat saat uji coba akan hilang.

> Jangan menjalankan `npm run test:smoke` ke produksi: skrip itu mengubah data dan menjalankan seed ulang.

## Verifikasi (definisi selesai Tahap B)

Hasil 9 Nov 2026:

- [x] Deploy log `api`: 14 migrasi diterapkan, `[api] CaterHub API siap`, `GET /health 200`, upload publik `/data/public`.
- [x] `web` online: `/` dan `/login` → 200; `/vendor` tanpa login → 307 ke `/login?next=/vendor`.
- [x] Seed demo sukses (5 vendor, data Dapur Nusantara, akun `pelanggan@demo.id` · `vendor1@demo.id` · `admin@caterhub.id`, sandi `demo1234`).
- [x] Login ketiga akun demo → 200, cookie `Secure`; dengan cookie itu `/vendor/dashboard` & `/vendor/costing` di URL publik menampilkan data seed (AUTH_SECRET sama, web → api lewat jaringan privat bekerja).
- [x] 10× salah sandi untuk satu email → percobaan ke-11 `429`.
- [x] File uji di `/data/public` tersaji lewat `https://<web>/uploads/...` dan **tetap ada setelah redeploy** `api` (volume persisten), lalu dihapus.
- [ ] Login manual lewat browser + alur `docs/DEMO_SCRIPT.md` di URL produksi (dicek pemilik).

## Pembayaran Midtrans (sandbox)

Aktif sejak v0.14.0. Variabel di service `api`:

| Variabel | Nilai |
|---|---|
| `PAYMENT_PROVIDER` | `midtrans` (kembalikan ke `mock` sebagai cadangan; tombol "Simulasikan bayar" muncul lagi) |
| `MIDTRANS_SERVER_KEY` | Server key **sandbox** (`SB-Mid-server-…`), diisi pemilik lewat dashboard |
| `MIDTRANS_IS_PRODUCTION` | `false` |
| `MIDTRANS_ENABLED_PAYMENTS` | opsional, default `other_qris` |

**Server key** dibuat di dashboard.sandbox.midtrans.com → *Settings → Access Keys → Generate*. Izin minimal: **Snap Checkout: Write** + **Core API: Read**; lainnya None. Key tidak bisa diedit: untuk mengubah izin, buat key baru → ganti variabel → Deploy → revoke key lama. Key berawalan `Mid-server-` (tanpa `SB-`) adalah key **production** dan ditolak sandbox (401).

**Webhook** tidak perlu diatur di dashboard Midtrans: URL `APP_URL/api/payments/webhook` dikirim per transaksi (header `X-Override-Notification`), masuk lewat `web` lalu diteruskan ke `api`. Notifikasi untuk key hasil generate ditandatangani dengan key lain, jadi API memverifikasi lewat `GET /v2/{order_id}/status` (itulah alasan izin Core API: Read). Notifikasi yang terlewat bisa dikirim ulang dari detail transaksi di dashboard Midtrans (*Resend notification*).

**Cara membayar saat demo**: halaman bayar → "Bayar QRIS via Midtrans" → di Snap, klik kanan QR → *Copy image address* → buka https://simulator.sandbox.midtrans.com/v2/qris/index → tempel → *Scan QR* → *Pay*. Halaman bayar CaterHub berubah menjadi lunas dalam ±5 detik.

> **Jangan bayar QR sandbox dengan e-wallet asli.** Aplikasi e-wallet bisa membaca QR sandbox (menampilkan data merchant, acquirer GoPay) karena QRIS hanya teks berformat standar, tetapi transaksinya tidak ada di jaringan pembayaran sungguhan.

**Ke mana uangnya di production**: ke saldo merchant Midtrans pemilik server key (CaterHub sebagai platform), lalu dicairkan ke rekening yang didaftarkan. Penerusan dana ke vendor (pencairan/split payment) di luar cakupan hackathon.

## WhatsApp via Fonnte

Aktif sejak v0.15.0. Variabel di service `api`:

| Variabel | Nilai |
|---|---|
| `WHATSAPP_PROVIDER` | `fonnte` (kembalikan ke `mock` sebagai cadangan) |
| `FONNTE_TOKEN` | token device dari dashboard Fonnte (per device; berubah bila device diganti), diisi pemilik |
| `DEMO_VENDOR_WHATSAPP` | nomor **penerima** vendor demo; seed memasangnya sebagai nomor usaha Dapur Nusantara |
| `WHATSAPP_ALLOWED_NUMBERS` | opsional; kosong = `DEMO_VENDOR_WHATSAPP`, `*` = semua nomor |

- **Dua nomor berbeda**: pengirim = device yang disambungkan ke Fonnte (pakai nomor cadangan — Fonnte mengotomasi WhatsApp biasa, jadi nomor pengirim berisiko diblokir bila terlihat seperti spam); penerima = nomor vendor demo (tanpa risiko). Simpan kontak pengirim di HP penerima dan balas sekali.
- **Pengaman**: provider asli hanya mengirim ke nomor yang diizinkan; nomor seed lain (karangan) → **Dilewati**. Pelanggan tidak menerima WA sungguhan.
- **Ganti penerima**: ubah `DEMO_VENDOR_WHATSAPP` → Deploy → **seed ulang** (nomor usaha vendor diisi saat seed).
- Pesan berprovider `mock` di kotak keluar adalah contoh dari seed. Alasan gagal Fonnte (device terputus, kuota) tampil di kotak keluar; pastikan device *connected* sebelum demo.

## Biaya & kredit

Trial Railway: 30 hari + kredit sekali US$5, tanpa kartu. Setelah habis, akun turun ke Free plan (US$1/bulan, tidak cukup untuk 3 service) → perlu Hobby US$5/bulan bila demo harus tetap online. Pantau di *Workspace → Usage*.

## Masalah umum

| Gejala | Penyebab / solusi |
|---|---|
| `api` crash: `AUTH_SECRET belum aman` | Nilai < 32 karakter atau mengandung kata seperti "insecure/example". Buat ulang dengan perintah di atas. |
| `api` crash: `DATABASE_URL belum diisi` | Variabel referensi salah nama; harus `${{Postgres.DATABASE_URL}}` sesuai nama service database. |
| `web` error 500 / `fetch failed` saat memuat data | `API_BASE_URL` salah atau `api` belum hidup. Pakai domain privat + port, skema `http://` (bukan https). Ubah variabel → redeploy `web` (rewrite `/uploads` ikut dibangun saat build). |
| Login berhasil tapi langsung keluar lagi | `AUTH_SECRET` berbeda antara `api` dan `web`. |
| Gambar hilang setelah redeploy | Volume belum terpasang di `/data` atau `PUBLIC_UPLOAD_DIR` tidak menunjuk ke `/data/public`. |
| Healthcheck gagal | Lihat deploy log; API harus listen di `PORT`. |
| Email "Deployment crashed" setiap deploy, padahal situs normal | Start command lewat `npm` (`npm run api:start` → `npm -w … run start`): saat container lama dihentikan, `npm` keluar dengan `npm error signal SIGTERM` (status gagal). Start command kini menjalankan Node langsung sehingga SIGTERM sampai ke handler shutdown dan proses keluar 0. Perubahan start command baru berlaku untuk deploy dari source (push, atau `railway service redeploy --from-source`); `redeploy` biasa memakai snapshot lama. |

## Lokal vs produksi

`npm run db:deploy` menjalankan Prisma CLI dari folder `backend`, yang tidak membaca `.env` root. Di Railway `DATABASE_URL` sudah berupa env var sehingga aman. Bila ingin mencobanya lokal dan muncul `Environment variable not found: DATABASE_URL`, set dulu `DATABASE_URL` di shell.
