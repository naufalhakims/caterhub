# Gap Analysis — Apa yang Masih Kurang

Semua temuan di bawah diverifikasi dari kode (path disertakan). Bagian [Status perbaikan P0](#status-perbaikan-p0-7-november-2026) di akhir dokumen mencatat apa yang sudah ditutup.

Prioritas:

- **P0** — bisa merusak demo/uang/data, atau langsung terlihat juri. Kerjakan sebelum presentasi.
- **P1** — fitur setengah jadi atau celah nyata; menaikkan kesan "produk siap pakai".
- **P2** — utang teknis / kesiapan produksi.

---

## A. Logika bisnis, uang, dan kapasitas

| # | Prio | Temuan | Lokasi | Dampak | Saran perbaikan |
|---|---|---|---|---|---|
| A1 | **P0** | Pembayaran bisa dibuat berkali-kali untuk satu booking. `POST /payments` selalu membuat `Payment` baru tanpa mengecek `PENDING` yang sudah ada. | `backend/src/modules/payments.ts` (handler `POST /`) | Dengan Midtrans, pelanggan bisa membayar dua QR berbeda → tertagih ganda; booking tetap `PAID`, kelebihan tidak tercatat. | Kembalikan payment `PENDING` yang masih berlaku; atau tandai yang lama `CANCELLED` dalam transaksi. Tambah partial unique index "satu PENDING per booking". |
| A2 | **P0** | Kapasitas dikunci saat vendor konfirmasi (sebelum bayar), dan booking `PAYMENT_PENDING` tidak pernah kedaluwarsa. | `domain/booking.ts` `confirmQuotationAndBook` | Pelanggan yang tidak membayar menahan kuota pax vendor selamanya → vendor UMKM kehilangan order lain. | Tambah `paymentDueAt` (mis. 24 jam / H-3 acara). Job/cron (atau lazy check saat baca) membatalkan booking & melepas `reservedPax`. |
| A3 | **P0** | Vendor bisa membatalkan booking yang **sudah lunas** (`PAID`, `PREPARING`) tanpa jejak refund. | `VALID_BOOKING_TRANSITIONS` di `domain/booking.ts`; `cancelBookingAndRelease` | Uang pelanggan "hilang" secara sistem; tidak ada alasan pembatalan; pelanggan tidak dinotifikasi. | Wajibkan alasan; buat status/record `REFUND_PENDING`; notifikasi pelanggan; admin melihat daftar refund. |
| A4 | P1 | Pelanggan **tidak bisa membatalkan** pesanan atau permintaan sama sekali. | tidak ada endpoint | Pelanggan terkunci; vendor harus dihubungi manual (balik ke WhatsApp). | Endpoint batal untuk pelanggan: bebas saat `REQUESTED`/`PAYMENT_PENDING`, dengan kebijakan (mis. potongan) setelah `PAID`. |
| A5 | P1 | Permintaan `REQUESTED` untuk tanggal yang sudah lewat tetap `REQUESTED` selamanya; `EXPIRED` hanya muncul saat pelanggan menekan "terima". | `quotations.ts`, `booking.ts` | Dashboard vendor penuh permintaan basi; statistik menyesatkan. | Job harian `REQUESTED/SENT` dengan `eventDate < hari ini` → `EXPIRED` + history. |
| A6 | P1 | Konfirmasi vendor tidak mengecek ulang status verifikasi vendor (hanya dicek saat pelanggan membuat permintaan). | `POST /quotations/:id/confirm` | Vendor yang verifikasinya dicabut masih bisa membuat booking & menerima uang. | Cek `verificationStatus === "VERIFIED"` di confirm & create payment. |
| A7 | P1 | Vendor terverifikasi bebas mengganti nama usaha/kota tanpa peninjauan ulang. | `PATCH /vendor/me` | Celah penipuan: identitas berubah setelah lolos verifikasi. | Perubahan field identitas → `UNDER_REVIEW` lagi, atau butuh persetujuan admin. |
| A8 | P2 | Webhook Midtrans tidak membandingkan `gross_amount` dengan `payment.amount`. Signature menjamin keaslian, tetapi tidak ada sanity check nominal. | `domain/payment.ts`, `payment-apply.ts` | Rendah, tapi praktik standar pembayaran. | Tolak settlement bila nominal berbeda; log untuk audit. |
| A9 | P2 | `MidtransPaymentProvider` mengirim `payment_type: "qris"` ke endpoint **Snap**; Snap memakai `enabled_payments`, `payment_type` adalah parameter Core API. | `domain/payment.ts` | QRIS mungkin tidak menjadi satu-satunya metode di halaman Snap. Perlu diuji di sandbox. | Ganti ke `enabled_payments: ["other_qris"]` atau pakai Core API `/v2/charge` untuk mendapat `qr_string` dan render QR sendiri. |
| A10 | P2 | Beberapa operasi multi-langkah tidak dalam transaksi (update quotation + history + notifikasi pada decline/decision/revisi; pembuatan notifikasi setelah request). | `modules/quotations.ts` | Bila langkah kedua gagal, audit trail tidak lengkap. | Bungkus dengan `db.$transaction`. |
| A11 | P2 | Analitik vendor mengelompokkan bulan dengan `getMonth()` zona waktu server, bukan `Asia/Jakarta`. | `GET /vendor/analytics` | Pembayaran tanggal 1 dini hari WIB bisa masuk bulan sebelumnya bila server UTC. | Pakai util `jakartaDateString`. |

## B. Fitur setengah jadi (backend ada, UI tidak)

| # | Prio | Temuan | Dampak |
|---|---|---|---|
| B1 | **P0** | **Notifikasi** ditulis di ±10 tempat (pesanan baru, konfirmasi, penolakan, pesan chat, ulasan, verifikasi) tetapi **tidak ada endpoint untuk membaca** maupun ikon/lonceng di UI. | Vendor tidak tahu ada pesanan masuk kecuali membuka dashboard. Ini inti "layanan pelanggan lebih baik" dalam tema lomba. |
| B2 | P1 | ✅ *Selesai v0.5.0* — Alur **penawaran vendor / negosiasi / revisi** (`POST /quotations`, `POST /quotations/:id/decision`) lengkap di API + tes, tetapi tidak ada form di UI. Halaman penawaran hanya menampilkan `revisionNote` bila ada. | Pesanan besar catering (pernikahan, korporat) biasanya butuh nego harga/menu — nilai jual utama vs marketplace biasa tidak terlihat. |
| B3 | P1 | ✅ *Selesai v0.5.0 (menu tambahan per pax)* — **Kustomisasi menu** tidak ada: `MenuItem.price` (harga add-on per pax) ditampilkan "+Rp…" tetapi pelanggan tidak bisa memilih menu tambahan. | Klaim "customize menus" di konsep produk belum terpenuhi. |
| B4 | P1 | Data acara (`eventType`, `budgetMin/Max`) dan `latitude/longitude` vendor tidak dipakai rekomendasi; "Lokasi dekat" = nama kota sama. | Rekomendasi terasa dangkal saat dijelaskan ke juri. |
| B5 | P2 | Pelanggan tidak bisa mengubah/menghapus acara; admin tidak bisa menangguhkan pengguna/vendor; paket tidak bisa dihapus (hanya nonaktif). | Operasional admin & pelanggan terbatas. |
| B6 | P2 | Tidak ada pemulihan kata sandi / verifikasi email (model `VerificationToken` ada tapi sisa NextAuth). | Hambatan nyata bagi pengguna UMKM yang sering lupa sandi. |
| B7 | P2 | Pencarian dibatasi 50 hasil tanpa paginasi; daftar admin (vendor, user, order) memuat semua baris. | Aman untuk demo, tidak untuk skala. |

## C. Keamanan

| # | Prio | Temuan | Saran |
|---|---|---|---|
| C1 ✅ v0.12.0 | P1 | Tidak ada rate limiting pada `/auth/login`, `/auth/register`, `/quotations/:id/messages`. | `express-rate-limit` per IP + per email. |
| C2 ✅ v0.12.0 | P1 | JWT berumur 30 hari tanpa mekanisme revoke; logout hanya menghapus cookie. Peran tertanam di token. | Kurangi TTL (mis. 7 hari) + `tokenVersion` di `User` yang dicek saat ganti sandi/penangguhan. |
| C3 ✅ v0.12.0 | P2 | Password minimal 6 karakter saat daftar, tetapi 8 saat ganti sandi — tidak konsisten. | Samakan ke 8. |
| C4 | P2 | Tidak ada CSRF token eksplisit. Saat ini aman karena mutasi lewat Server Actions (cek Origin bawaan Next) dan cookie `sameSite=lax`, tetapi route handler `/api/quotations/request` & `/api/payments/mock-settle` menerima form POST biasa. | Cek header `Origin` di route handler tersebut. |
| C5 | P2 | Chat tanpa moderasi/filter nomor HP; vendor & pelanggan bisa memindahkan transaksi ke luar platform. | Deteksi pola nomor telepon/rekening dan beri peringatan (juga melindungi pelanggan dari penipuan). |

## D. Kesiapan produksi / utang teknis

| # | Prio | Temuan | Saran |
|---|---|---|---|
| D1 | P1 | File disimpan di disk lokal (`backend/public/uploads`, `backend/storage/private`). Tidak cocok untuk hosting serverless/ephemeral (Vercel, Railway tanpa volume). | Abstraksi `storage.ts` sudah memudahkan; ganti ke S3/R2/Supabase Storage dengan signed URL untuk dokumen privat. |
| D2 | P1 | Tidak ada CI (GitHub Actions) yang menjalankan `typecheck` + `test` + `lint`. | Satu workflow sederhana. |
| D3 | P1 | Tidak ada integration test terhadap PostgreSQL untuk bagian paling kritis (overbooking race, webhook idempoten). | Testcontainers atau DB test terpisah + `vitest` pool. |
| D4 | P2 | Duplikasi logika `scoreVendor` dan `quotation-workflow` di frontend & backend. | Hapus salinan frontend atau pindah ke paket `shared/`. |
| D5 | P2 | Model & enum sisa: `Account`, `Session`, `VerificationToken`, status Booking `QUOTATION_*`/`CONFIRMED`, `depositAmount/remainingAmount`. | Bersihkan lewat migrasi agar skema mencerminkan alur "lunas saja". |
| D6 | P2 | Logging hanya `console.log`; tidak ada request ID, tidak ada error tracking. | `pino` + Sentry. |
| D7 | P2 | Tidak ada Dockerfile / docker-compose untuk Postgres + API + web. | Mempercepat juri/rekan menjalankan project. |
| D8 | P2 | Kota di-hardcode `Surabaya | Sidoarjo | Gresik` di backend. | Pindah ke tabel/konfigurasi agar bisa ekspansi. |

## E. UI/UX & aksesibilitas

| # | Prio | Temuan | Saran |
|---|---|---|---|
| E1 | P1 | Tidak ada pusat notifikasi / badge jumlah (lihat B1). | Lonceng di `Navbar`/`SideNav` + halaman `/notifications`. |
| E2 | P1 | Halaman pembayaran mock menampilkan "QR tiruan" + payload teks. | Render QR sungguhan dari payload (`qrcode` lib) agar demo terlihat nyata dan bisa dipindai. |
| E3 | P2 | Animasi `animate-rise` tidak menghormati `prefers-reduced-motion`. | Tambah media query di `globals.css`. |
| E4 | P2 | Tidak ada mode gelap; font display `Georgia` sistem. | Opsional; prioritaskan konsistensi dan kontras. |
| E5 | P2 | Pembaruan status mengandalkan `AutoRefresh` (polling halaman). | Cukup untuk demo; jangka panjang SSE/WebSocket untuk chat & status. |
| E6 | P2 | Banyak alur memakai redirect `?error=`/`?ok=` di query string. | Toast/inline feedback; hapus parameter setelah ditampilkan. |

## F. Kesenjangan terhadap tema lomba (UMKM & ekonomi digital)

Tema: *bagaimana sistem web membantu UMKM mengelola operasional, meningkatkan produktivitas, dan melayani pelanggan lebih baik.* Yang sudah kuat: kapasitas harian, konfirmasi pesanan terstruktur, status produksi, analitik pendapatan, verifikasi kepercayaan. Yang belum ada dan sangat relevan untuk catering UMKM:

1. **Notifikasi ke kanal yang dipakai UMKM** (WhatsApp) — vendor UMKM hidup di WhatsApp, bukan di dashboard. ✅ *Selesai v0.7.0 (outbox + adapter mock; provider asli tinggal ditambahkan).*
2. **Nota/invoice & kuitansi PDF** — kebutuhan administrasi pelanggan korporat dan bukti transaksi vendor. ✅ *Selesai v0.8.0.*
3. **Lembar produksi dapur** (rekap porsi per menu per tanggal) dan **perhitungan bahan baku / HPP** — inti "produktivitas operasional". ✅ *Selesai v0.6.0.*
4. **Pencatatan pesanan offline** — vendor tetap menerima order dari WhatsApp/telepon; tanpa input manual, kalender & kapasitas di CaterHub tidak akurat. ✅ *Selesai v0.8.0.*
5. **Pencairan dana / rekonsiliasi** — belum ada konsep saldo vendor, komisi platform, atau payout.
6. **Badge kepercayaan** (sertifikat halal, PIRT/NIB, SLHS) yang terbaca pelanggan, bukan hanya status "terverifikasi".

Rincian rencana untuk menutup gap ini ada di [ROADMAP_PENGEMBANGAN.md](./ROADMAP_PENGEMBANGAN.md).

---

## Status perbaikan P0 (7 November 2026)

| Gap | Status | Implementasi |
|---|---|---|
| A1 Tagihan ganda | ✅ | `POST /payments` mengunci baris booking (`FOR UPDATE`), memakai ulang `PENDING` yang masih berlaku, menandai yang kedaluwarsa `EXPIRED`. Kolom baru `Payment.expiresAt` (30 menit, dipotong batas pelunasan); Midtrans diberi `expiry` yang sama. `mock-settle` menolak tagihan non-aktif. |
| A2 Kapasitas tertahan | ✅ | Kolom `Booking.paymentDueAt` (`computePaymentDueAt`: 24 jam, tidak melewati 00:00 WIB hari acara, minimal 1 jam; atur via `PAYMENT_WINDOW_HOURS`). `domain/expiry.ts`: penjadwal 5 menit + sapuan lazy (maks. 1×/menit) saat dashboard/daftar pesanan dibaca; membatalkan booking, melepas `reservedPax`, membatalkan tagihan, memberi notifikasi. |
| A5 Permintaan basi | ✅ | Sapuan yang sama meng-`EXPIRED`-kan quotation terbuka yang tanggal acaranya lewat / `expiresAt` habis, dengan history & notifikasi. |
| A3 Batal setelah lunas | ✅ | Status baru `REFUND_PENDING` → `REFUNDED`; `PAID/PREPARING → CANCELLED` tidak lagi valid. Kolom `cancelReason`, `cancelledBy`, `refundAmount`, `refundedAt`. Admin: tab "Menunggu refund" + `POST /admin/bookings/:id/refund`. Pembayaran yang masuk setelah pesanan dibatalkan otomatis menjadi refund; pembayaran ganda dilaporkan ke admin. Pendapatan vendor/admin tidak menghitung pesanan batal/refund. |
| A4 Pelanggan tak bisa batal | ✅ | `POST /bookings/:id/cancel` (pelanggan & vendor, alasan wajib ≥5 karakter). Kebijakan `decideCancellation`: belum lunas bebas; lunas → vendor boleh, pelanggan sampai H-3; READY ke atas tidak bisa. Tombol status vendor tidak lagi bisa membatalkan. |
| B1 Notifikasi tak terbaca | ✅ | `GET /me/notifications`, `POST /me/notifications/read`; kolom `Notification.link` (deep link) diisi di semua titik pembuatan. Lonceng + badge di Navbar, halaman `/notifications` (buka = tandai dibaca lalu menuju halaman terkait). |
| E2 QR tiruan | ✅ | QR asli dirender di server dengan `qrcode` dari `qrPayload`; menampilkan masa berlaku, status kedaluwarsa/batal; halaman bayar menyegarkan diri tiap 5 detik selama tagihan aktif. |
| E3 Reduced motion | ✅ | Semua animasi berganti cross-fade di `prefers-reduced-motion`; juga dukungan `prefers-reduced-transparency` & `prefers-contrast`. |
| A11 Zona waktu analitik | ✅ (bonus) | Pengelompokan bulan memakai WIB. |
| Bug teks `
` di daftar pesanan vendor | ✅ (bonus) | Literal `
` yang tampil di layar dihapus. |

Penerapan apple-design (komponen dasar): umpan balik tekan instan & status "Memproses…" pada semua tombol Server Action (`FormButton`, `SubmitButton`), toast hasil aksi yang membersihkan `?ok=/?error=` dari URL (`Flash`), Navbar material tembus pandang, `OrderStepper` (wayfinding), konfirmasi hanya untuk aksi destruktif (`CancelBookingForm`), kartu interaktif `pressable`, tipografi judul dengan tracking negatif, `aria-current` pada navigasi, label navigasi yang spesifik.

Verifikasi: 81 unit test lulus (backend 48 termasuk `booking-policy.test.ts`, frontend 33), typecheck & lint bersih, `next build` sukses, dan smoke test E2E terhadap API lokal untuk A1/A2/A3/A4/B1 lulus.

Skrip demo + seed yang bercerita: ✅ selesai di v0.9.0 ([DEMO_SCRIPT.md](./DEMO_SCRIPT.md)). Booking lama (dibuat sebelum migrasi) tidak memiliki `paymentDueAt` sehingga tidak kedaluwarsa otomatis.

## Status keamanan C1–C3 (9 November 2026, v0.12.0)

| Gap | Status | Implementasi |
|---|---|---|
| C1 Rate limit | ✅ | `backend/src/lib/rate-limit.ts` (sliding window di memori): login gagal 10×/15 menit **per email** (login lewat BFF Next sehingga IP selalu sama), daftar 20/jam, chat 30/menit per pengguna → `429 RATE_LIMITED`. Catatan: hitungan di memori → cukup untuk 1 instance API; butuh Redis bila diskalakan. |
| C2 Sesi | ✅ | TTL 7 hari; `User.tokenVersion` di klaim `tv` dicek ke DB setiap request (beserta peran) → ganti sandi mencabut sesi perangkat lain, perangkat sendiri diberi cookie baru. |
| C3 Sandi | ✅ | Minimal 8 karakter di semua tempat (daftar, ganti sandi, validasi frontend). |
