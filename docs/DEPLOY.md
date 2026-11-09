# Deploy ke Railway

Panduan deploy CaterHub untuk demo hackathon (Fase 2 Tahap B). Platform dipilih **Railway** karena API harus **selalu hidup**: penjadwal (mulai masak 00:00 WIB, kedaluwarsa pembayaran, selesai otomatis 24 jam) dan batas percobaan login berjalan di dalam proses API, dan unggahan butuh disk persisten. Render gratis ditolak karena service tidur setelah 15 menit, disk tidak persisten, dan Postgres gratis kedaluwarsa 30 hari.

> **Secret tidak pernah masuk repo.** `AUTH_SECRET`, key Midtrans, token Fonnte hanya diisi di tab *Variables* Railway.

## Arsitektur

Satu project Railway, region **Southeast Asia (Singapore)**:

| Service | Isi | Config file | Domain |
|---|---|---|---|
| `Postgres` | PostgreSQL terkelola Railway | — | privat |
| `api` | Express (`npm run api:start`), **1 replika**, volume `/data` | `/backend/railway.json` | privat (publik nanti untuk webhook Midtrans, Tahap C) |
| `web` | Next.js (`npm start`) | `/frontend/railway.json` | publik `*.up.railway.app` |

Browser hanya berbicara dengan `web`. Next meneruskan permintaan dan cookie ke API lewat jaringan privat Railway (`API_BASE_URL`), termasuk gambar `/uploads/*` (rewrite di `frontend/next.config.mjs`).

Kedua service memakai **root repo** sebagai root directory (npm workspaces + satu `package-lock.json`); perbedaannya hanya di config file.

### Yang diatur oleh config file

| | `api` | `web` |
|---|---|---|
| Build | `npm ci` (otomatis, `postinstall` → `prisma generate`) + `npm run api:typecheck` | `npm ci` + `npm -w frontend run build` |
| Pre-deploy | `npm run db:deploy` (`prisma migrate deploy`) | — |
| Start | `npm run api:start` | `npm start` (`next start`, membaca `PORT`) |
| Healthcheck | `/health` | `/login` |
| Redeploy bila berubah | `backend/**`, `package*.json` | `frontend/**`, `package*.json` |

API membaca `PORT` (disuntik Railway) lalu `API_PORT`, default 4000. Node dikunci `22.x` lewat `engines` di `package.json` root.

## Langkah setup (sekali)

1. **New Project → Deploy from GitHub repo → `caterhub`.** Ganti nama service menjadi `api`.
   *Settings → Config-as-code → Railway Config File:* `/backend/railway.json`. Region: Singapore.
2. **+ New → Database → Add PostgreSQL** (nama `Postgres`).
3. **+ New → GitHub Repo → `caterhub` lagi**, beri nama `web`. Config file: `/frontend/railway.json`.
4. **Volume:** klik service `api` → *Attach Volume* (atau klik kanan → Volume) → mount path **`/data`**.
5. **Variables `api`:**

   | Variabel | Nilai |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `AUTH_SECRET` | hasil `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `APP_URL` | `https://<domain-web>` |
   | `CORS_ORIGIN` | `https://<domain-web>` |
   | `UPLOAD_DIR` | `/data/private` |
   | `PUBLIC_UPLOAD_DIR` | `/data/public` |
   | `PAYMENT_PROVIDER` | `mock` |
   | `PAYMENT_WINDOW_HOURS` | `24` |
   | `WHATSAPP_PROVIDER` | `mock` |
   | `ALLOW_MOCK_WEBHOOK` | `false` |
   | `ALLOW_DEMO_SEED` | `true` |

6. **Variables `web`:**

   | Variabel | Nilai |
   |---|---|
   | `NODE_ENV` | `production` |
   | `AUTH_SECRET` | `${{api.AUTH_SECRET}}` (harus sama dengan API) |
   | `API_BASE_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` |

7. **`web` → Settings → Networking → Generate Domain.** Salin domainnya ke `APP_URL` dan `CORS_ORIGIN` di `api` (format `https://...`, tanpa garis miring di akhir).
8. Klik **Deploy** (Railway menampilkan perubahan yang belum diterapkan). Pastikan `api` tetap **1 replika**: rate limit dan penjadwal disimpan di memori proses.

## Seed data demo

Seed menolak berjalan di production kecuali `ALLOW_DEMO_SEED=true`. Jalankan dari dalam container API:

```bash
railway link              # pilih project caterhub
railway ssh --service api
npm run db:seed
```

**Jalankan seed ulang pada hari demo**: tanggal pesanan demo dihitung relatif terhadap hari seed dijalankan. Seed mengosongkan data, jadi akun/pesanan yang dibuat saat uji coba akan hilang.

> Jangan menjalankan `npm run test:smoke` ke produksi: skrip itu mengubah data dan menjalankan seed ulang.

## Verifikasi (definisi selesai Tahap B)

- [ ] Deploy log `api`: `prisma migrate deploy` sukses, `[api] CaterHub API siap`.
- [ ] `https://<domain-web>/` terbuka; login akun demo (lihat `docs/DEMO_SCRIPT.md`) berhasil.
- [ ] Unggah foto menu → **Redeploy** `api` → foto masih tampil (volume bekerja).
- [ ] 10× salah sandi untuk satu email → pesan "Coba lagi dalam N menit".
- [ ] Alur `docs/DEMO_SCRIPT.md` berjalan di URL produksi.

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

## Lokal vs produksi

`npm run db:deploy` menjalankan Prisma CLI dari folder `backend`, yang tidak membaca `.env` root. Di Railway `DATABASE_URL` sudah berupa env var sehingga aman. Bila ingin mencobanya lokal dan muncul `Environment variable not found: DATABASE_URL`, set dulu `DATABASE_URL` di shell.
