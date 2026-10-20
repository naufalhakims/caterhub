# Pemisahan frontend & backend — catatan migrasi

Status: **selesai**. Next.js hanya UI; Express API memiliki database, auth, otorisasi, aturan bisnis, dan file.

Dokumen ini mencatat keputusan, batas modul, dan hal yang perlu diketahui saat merawat/mendeploy. Kontrak endpoint ada di [`../backend/README.md`](../backend/README.md).

## 1. Keputusan

| Keputusan | Alasan |
|---|---|
| npm workspaces: `frontend/` + `backend/` | Satu repo, dependency & proses terpisah, tanpa memperkenalkan tooling monorepo baru. |
| Express + TypeScript + Prisma | Reuse skema, migrasi, Zod, dan domain yang sudah ada; risiko rewrite paling rendah. |
| JWT HS256 di cookie httpOnly | Tidak perlu NextAuth; Next (Edge) dan API memverifikasi token yang sama dengan `AUTH_SECRET`. |
| BFF tipis di Next | Server Component tidak boleh sentuh DB; Server Action hanya memanggil REST dan mengurus redirect/revalidate. |
| API sebagai satu-satunya penegak otorisasi resource | UI/middleware bisa dilewati; kepemilikan quotation/booking/payment/dokumen harus dicek di server data. |

Sebelumnya dievaluasi juga NestJS, Go, Laravel, dan Supabase/PostgREST. Untuk tim kecil dan domain transaksional (kapasitas, transisi status) Express + TS memberi perubahan paling kecil.

## 2. Batas tanggung jawab

| Area | Frontend (`frontend/`) | Backend (`backend/`) |
|---|---|---|
| Render & navigasi | ✅ | — |
| Middleware rute berbasis peran | ✅ (gerbang awal) | — |
| Baca/tulis data | lewat `fetch` ke API | ✅ Prisma/PostgreSQL |
| Login/register/logout | form → API, simpan cookie | ✅ verifikasi password (bcrypt), terbitkan JWT |
| Otorisasi per-resource | tidak | ✅ `requireRole` + cek kepemilikan di modul |
| Aturan bisnis | tidak | ✅ `src/domain/*` |
| Validasi input | validasi UX ringan | ✅ Zod (sumber kebenaran) |
| Upload | forwarding `FormData` | ✅ validasi magic bytes, simpan/hapus file |
| Menyajikan file | rewrite `/uploads`, proxy dokumen | ✅ static publik & route privat ber-otorisasi |

Frontend **tidak lagi** mengimpor `@prisma/client`, `next-auth`, `bcrypt`, atau `@/lib/db`.

## 3. Alur request

### Baca halaman (Server Component)

```
Browser ──cookie──> Next Server Component
                         │ apiGet('/api/v1/...') + cookie
                         ▼
                    Express API ──Prisma──> PostgreSQL
```

`frontend/src/lib/api.ts` meneruskan cookie sesi, memakai `cache: "no-store"`, dan membungkus error menjadi `ApiError`.

### Mutasi (Server Action)

```
<form action={serverAction}>
  → parse FormData/JSON
  → apiPost/apiPatch/apiForm/apiDelete
  → redirect + revalidatePath
```

Tidak ada pemanggilan Prisma atau pengecekan kepemilikan di frontend. Contoh: `vendor-actions.ts`, `quotation-actions.ts`, `admin-actions.ts`, `image-actions.ts`, `verification-actions.ts`.

### Route handler BFF

| Route Next | Diteruskan ke |
|---|---|
| `POST /api/quotations/request` | `POST /api/v1/quotations/request` |
| `POST /api/payments/mock-settle` | `POST /api/v1/payments/:id/mock-settle` |
| `POST /api/payments/webhook` | `POST /api/v1/payments/webhook` (raw body + content-type) |
| `GET /api/vendor-documents/[id]` | `GET /api/v1/documents/:id` (cookie diteruskan, respons file diproxy) |

## 4. Auth & sesi

- Cookie: `caterhub_session` (httpOnly, `SameSite=Lax`, `Path=/`, 30 hari).
- Payload: `sub` (user id), `role`, `email`, `name`; algoritma HS256.
- API: `attachUser` global → `req.user`; `requireAuth`/`requireRole` per route.
- Next: `middleware.ts` + `lib/route-access.ts` mengarahkan tamu/peran salah; `lib/session.ts` membaca token untuk Navbar dan pengecekan halaman.
- Cookie bersifat **host-scoped** (port diabaikan), jadi cookie dari `localhost:4000` juga terbaca di `localhost:3000`. BFF tetap meneruskan cookie ke API; saat login, Next menulis ulang cookie agar masa berlakunya konsisten.
- `SameSite=Lax` + Server Actions Next (origin check bawaan) mengurangi CSRF. API juga membatasi `CORS_ORIGIN`. Untuk produksi multi-domain, pertimbangkan CSRF token eksplisit dan `SameSite=None; Secure`.

## 5. Modul yang dimigrasikan

- [x] Auth/register/login/logout/password + sesi JWT
- [x] Profil customer & profil vendor
- [x] Event (buat/daftar/detail)
- [x] Katalog publik + kapasitas publik
- [x] Permintaan & penawaran (kirim, tolak, terima/tolak/revisi, riwayat, chat)
- [x] Booking + transisi status + anti-overbooking
- [x] Dashboard customer/vendor + analitik
- [x] Menu, paket, kalender, kapasitas, pesanan, penawaran vendor
- [x] Verifikasi vendor + dokumen privat
- [x] Upload gambar (logo, cover, galeri, menu, paket)
- [x] Admin (dashboard, users, orders, vendors, detail, keputusan verifikasi)
- [x] Pembayaran (mock/Midtrans) — fitur ditunda, hardening tetap
- [x] Hapus jalur Prisma/NextAuth/bcrypt dari frontend

## 6. Penyimpanan file

| Jenis | Lokasi | Akses |
|---|---|---|
| Gambar publik | `backend/public/uploads` | `GET /uploads/*` (static API, rewrite Next) |
| Dokumen verifikasi | `backend/storage/private/verification` | `GET /api/v1/documents/:id` (ADMIN/pemilik) |

Validasi: maks 5 MB, magic bytes JPG/PNG/WEBP/PDF, folder disanitasi per segmen, file lama dihapus saat diganti. Kedua folder gitignored.

## 7. Pengujian & verifikasi

Otomatis:

```bash
npm test            # frontend 31 + backend 29
npm run typecheck   # frontend + backend
npm run lint
npm run build       # backend typecheck + next build
```

Cakupan: matriks rute/RBAC, akses resource (IDOR), kapasitas/tanggal, transisi penawaran, Rupiah, signature webhook, katalog & envelope API.

Smoke manual (API + Next berjalan):

- Login ketiga peran; cookie terbaca lintas port.
- Semua halaman customer/vendor/admin → 200; peran salah → 307 ke beranda; tamu → 307 ke login.
- Detail milik orang lain: customer → quotation/booking 404; vendor lain → 404; dokumen privat customer → 403; anonim → 401.
- Upload gambar: API menyimpan, `/uploads` via Next → 200, hapus menghapus file.
- Upload dokumen: vendor/admin bisa baca, customer 403.
- Permintaan penawaran lewat BFF `POST /api/quotations/request` → 303 ke detail quotation baru.
- Dashboard/analitik/kapasitas vendor dan seluruh halaman admin memuat data dari API.

## 8. Risiko & batasan

- **Satu secret bersama** — rotasi `AUTH_SECRET` mengeluarkan semua sesi; belum ada refresh token/revocation list.
- **Belum ada rate limit** di login/webhook; tambahkan di reverse proxy atau middleware sebelum produksi.
- **Filesystem lokal** tidak persisten di platform read-only; gunakan object storage.
- **Pembayaran ditunda** — jangan aktifkan `ALLOW_MOCK_WEBHOOK` di produksi; endpoint mock-settle tetap butuh login + kepemilikan.
- **Dua service** menambah hop jaringan; ukur p95 produksi. Katalog sempat diukur +1,5 ms p50 pada mesin lokal, tetapi angka itu bukan jaminan lintas jaringan.
- **Belum ada contract test lintas service**; regresi kontrak saat ini ditangkap typecheck + smoke manual.

## 9. Rollback

Tidak ada lagi fallback otomatis ke Prisma di Next. Untuk rollback:

1. Kembalikan commit migrasi (frontend + backend) bersama-sama; skema Prisma tetap satu sehingga tidak ada migrasi DB terbalik yang diperlukan untuk perubahan kode murni.
2. Jika hanya ingin mematikan frontend baru, jalankan versi frontend sebelumnya terhadap API yang sama — API kompatibel dengan kontrak `/api/v1`.
3. Folder `backend/` tidak bisa dihapus tanpa memindahkan kembali modul ke Next.

## 10. Langkah lanjutan

1. Rate limit + observability (request id, log terstruktur, metrics).
2. Object storage + signed URL untuk unggahan.
3. Refresh token/rotasi sesi dan CSRF eksplisit bila frontend & API beda domain.
4. Contract test (OpenAPI/Zod schema) antara frontend dan API.
5. Selesaikan fitur pembayaran (idempotency webhook, rekonsiliasi) — saat ini sengaja ditunda.
