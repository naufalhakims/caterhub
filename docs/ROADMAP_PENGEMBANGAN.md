# Roadmap Pengembangan CaterHub

Fokus: tema hackathon **"Accelerating Digital Transformation for Business and SMEs" — UMKM & Ekonomi Digital**. Rekomendasi diurutkan dari yang paling berdampak untuk penilaian juri dan paling murah dikerjakan. Nomor seperti `A1`, `B1` merujuk ke [GAP_ANALYSIS.md](./GAP_ANALYSIS.md).

---

## Fase 0 — Wajib sebelum demo (±2–3 hari) — ✅ selesai 7 Nov 2026

Tujuan: alur demo bersih dari ujung ke ujung, tidak ada celah uang yang bisa ditanyakan juri.

> **Status implementasi:** semua butir di bawah sudah dikerjakan; "Skrip demo + data seed" selesai di v0.9.0 ([DEMO_SCRIPT.md](./DEMO_SCRIPT.md)). Ringkasan teknis ada di [GAP_ANALYSIS.md § Status perbaikan P0](./GAP_ANALYSIS.md#status-perbaikan-p0-7-november-2026). Prinsip apple-design juga sudah diterapkan ke komponen dasar (lihat bagian *Saran UI/UX* — butir 1, 2, 3, 6, 7, 8, 9).

| Pekerjaan | Gap | Estimasi | Catatan implementasi |
|---|---|---|---|
| Satu payment `PENDING` per booking | A1 | 2 jam | Di `POST /payments`: cari `PENDING` yang belum kedaluwarsa → kembalikan; kalau tidak ada baru buat. Bungkus dalam transaksi. |
| Batas waktu bayar + pelepasan kapasitas | A2 | 4 jam | Kolom `Booking.paymentDueAt`. Fungsi `expireUnpaidBookings()` dipanggil (a) `setInterval` di `index.ts` tiap 10 menit dan (b) lazy saat dashboard vendor dibuka. Tampilkan hitung mundur di halaman booking. |
| Pembatalan yang jujur | A3, A4 | 4 jam | Alasan wajib; pelanggan bisa batal saat `PAYMENT_PENDING`; pembatalan setelah `PAID` → status `REFUND_PENDING` + notifikasi + muncul di admin. |
| Pusat notifikasi | B1, E1 | 4 jam | `GET /me/notifications?unread=1`, `POST /me/notifications/read`. Lonceng + badge di `Navbar`/`SideNav`, halaman `/notifications`. Data sudah ditulis, tinggal dibaca. |
| QR sungguhan di halaman bayar | E2 | 1 jam | Render `qrPayload` dengan library `qrcode`. Demo terasa nyata; bisa dipindai dari HP juri (tetap mock). |
| Expire otomatis permintaan basi | A5 | 1 jam | Ikut job yang sama dengan A2. |
| Hormati `prefers-reduced-motion` | E3 | 15 menit | `@media (prefers-reduced-motion: reduce) { .animate-rise { animation: none; } }` |
| Skrip demo + data seed yang bercerita | — | 2 jam | Seed 3 vendor dengan profil berbeda (rumahan kecil, menengah, besar), 1 pesanan di tiap status, sehingga semua layar terisi saat demo. |

## Fase 1 — Pembeda untuk hackathon (±1–2 minggu)

Pilih 3–4 yang paling sesuai waktu. Diurutkan dari dampak narasi UMKM tertinggi.

> **Keputusan & status (7 Nov 2026) — Fase 1 selesai.** Dipilih empat fitur, dikerjakan berurutan:
>
> | Tahap | Fitur | Status |
> |---|---|---|
> | 1 | Negosiasi & kustomisasi menu (#3) | ✅ selesai — v0.5.0, lihat [CHANGELOG](./CHANGELOG.md) |
> | 2 | Lembar produksi dapur + kalkulator HPP (#2) | ✅ selesai — v0.6.0 |
> | 3 | Notifikasi WhatsApp (#1) — **adapter mock dulu** | ✅ selesai — v0.7.0 |
> | 4 | Invoice PDF (#4) + input pesanan offline (#5) | ✅ selesai — v0.8.0 |
>
> Rekomendasi cerdas (#6): bagian **jarak nyata & ongkir otomatis** selesai di v0.11.0 (sisa: `eventType`/budget minimum & asisten AI). Badge kepercayaan (#7) belum dijadwalkan. Skrip demo + seed bercerita (sisa Fase 0) ✅ selesai di v0.9.0.

### 1. Notifikasi WhatsApp untuk vendor ⭐ — ✅ selesai dengan adapter mock (v0.7.0)
- **Kenapa:** pelaku UMKM catering hidup di WhatsApp. Ini menjawab langsung "layanan pelanggan lebih baik" tanpa memaksa vendor membuka dashboard.
- **Bagaimana:** abstraksi `Notifier` (seperti `PaymentProvider` yang sudah ada) dengan adapter `db` (sekarang), `whatsapp` (Fonnte/Wablas/WhatsApp Cloud API), `email`. Panggil di titik yang sudah membuat `Notification`. Link "Buka pesanan" langsung ke halaman terkait.
- **Mode demo:** adapter `console`/mock yang menampilkan pesan di panel samping.

### 2. Lembar produksi dapur & kalkulator bahan baku ⭐ — ✅ selesai (v0.6.0)
- **Kenapa:** inilah "produktivitas operasional" yang sesungguhnya. Marketplace biasa tidak punya.
- **Bagaimana:**
  - Tabel `Ingredient` & `MenuItemIngredient` (gram/porsi, harga satuan).
  - Halaman `/vendor/production?date=` → rekap semua booking `PAID/PREPARING` pada tanggal itu: total porsi per menu, total bahan (kg/liter), daftar belanja, versi cetak.
  - **HPP & margin per paket** di halaman paket: "Paket Nasi Box Rp35.000 → HPP Rp22.400 → margin 36%". Membantu UMKM menetapkan harga yang sehat.

### 3. Negosiasi & kustomisasi menu (aktifkan yang sudah ada) ⭐ — ✅ selesai (v0.5.0)
- **Kenapa:** API `POST /quotations` dan `/decision` beserta tesnya sudah lengkap (B2). Biaya kecil, nilai demo besar.
- **Bagaimana:**
  - Pelanggan saat meminta pesanan bisa mencentang menu tambahan (`MenuItem.price` per pax) → baris `QuotationItem` tambahan (B3).
  - Vendor: tombol "Kirim penawaran khusus" yang mengubah item/harga → status `SENT`.
  - Pelanggan: tombol Terima / Minta revisi / Tolak.
  - Tampilkan riwayat versi dari `QuotationHistory` sebagai timeline.

### 4. Nota, invoice, dan kuitansi PDF — ✅ selesai (v0.8.0, halaman cetak)
- Nomor invoice berurutan per vendor, logo vendor, rincian item, status lunas, QR verifikasi keaslian.
- Pelanggan korporat butuh untuk reimburse; vendor butuh untuk pembukuan.

### 5. Input pesanan offline (manual) oleh vendor — ✅ selesai (v0.8.0)
- Vendor mencatat order dari WhatsApp/telepon → ikut memotong kapasitas dan muncul di kalender & lembar produksi.
- Menjadikan CaterHub **satu-satunya sumber kebenaran** operasional vendor, bukan hanya kanal tambahan. Ini argumen kuat untuk "digitalisasi" (bukan sekadar "marketplace").

### 6. Rekomendasi yang lebih cerdas
- Pakai `latitude/longitude` (sudah ada di skema) + jarak ke lokasi acara → ongkir otomatis & alasan "±4 km dari lokasi".
- Ikutkan `eventType` (paket cocok untuk "pernikahan"/"rapat") dan `budgetMin`.
- Opsional AI: asisten "Ceritakan acaramu" → ekstrak tanggal, pax, budget, preferensi (halal/vegetarian) → isi filter otomatis. Tampilkan alasan rekomendasi seperti yang sudah ada (transparan).

### 7. Badge kepercayaan
- Jenis dokumen baru: `HALAL_CERT`, `NIB`, `PIRT`, `SLHS` dengan tanggal kedaluwarsa. Admin memverifikasi per dokumen; badge tampil di kartu vendor dan bisa difilter ("Halal saja").

## Fase 2 (hackathon) — integrasi esensial

> **Keputusan (9 Nov 2026).** Untuk hackathon, "minimum agar app berjalan" adalah **bisa diakses publik & stabil**, bukan uang/WA sungguhan. Ruang lingkup yang disetujui, berurutan:
>
> | Tahap | Isi | Status |
> |---|---|---|
> | A | Perbaikan Fase 1: smoke test E2E di repo (`npm run test:smoke`), cek tampilan mobile halaman vendor, keamanan login (batas percobaan, sesi lebih pendek + pencabutan, sandi min. 8) | ✅ v0.12.0 |
> | B | Siap deploy **Railway/Render**: API selalu hidup (penjadwal di dalam proses), PostgreSQL terkelola, volume persisten untuk unggahan, konfigurasi produksi | ⏳ |
> | C | **Midtrans sandbox** end-to-end (perbaiki parameter Snap QRIS & cek nominal webhook); mock tetap sebagai cadangan | ⏳ |
> | D | **WhatsApp via Fonnte** ke nomor demo (adapter + saklar env); kotak keluar mock tetap sebagai cadangan | ⏳ |
>
> **Tidak dikerjakan untuk hackathon** (disebut sebagai rencana lanjutan): WhatsApp Cloud API resmi, pencairan dana/split payment, refund via API, geocoding sendiri, PWA, akun staf dapur.

## Fase 2+ — Pasca-hackathon / pilot dengan UMKM nyata (1–3 bulan)

| Area | Pekerjaan |
|---|---|
| **Keuangan** | Saldo vendor, komisi platform (mis. 3–5%), jadwal pencairan, laporan rekonsiliasi; atau split payment Midtrans/Xendit. Refund nyata via API provider. |
| **Pembayaran** | Opsi DP + pelunasan untuk acara besar (skema sudah punya sisa kolom `depositAmount`); VA bank & e-wallet selain QRIS. |
| **Akun** | Lupa sandi via email/WhatsApp OTP, verifikasi nomor HP, login Google. Akun staf vendor (dapur, kurir) dengan peran terbatas. |
| **Operasional vendor** | Kalender libur/blackout, kapasitas per paket (bukan hanya per hari), pengiriman: penugasan kurir & bukti foto serah terima. |
| **Pelanggan** | Edit/hapus acara, pesan ulang (re-order) dari pesanan lama, favorit vendor, langganan katering harian/mingguan (kantor, kos). |
| **Admin** | Penangguhan akun, sengketa/komplain, moderasi ulasan, dashboard GMV, retensi, tingkat konfirmasi vendor. |
| **Keamanan** | ~~Rate limit, TTL JWT lebih pendek + `tokenVersion`~~ (✅ v0.12.0); rate limit terdistribusi (Redis) bila API lebih dari 1 instance, cek `Origin` pada route handler, deteksi nomor HP di chat (C4–C5). |
| **Infrastruktur** | Object storage (D1), Docker Compose (D7), CI GitHub Actions (D2), integration test PostgreSQL (D3), logging terstruktur + Sentry (D6), bersihkan skema sisa (D5). |

## Fase 3 — Skala

- PWA untuk vendor (notifikasi push, mode offline untuk lembar produksi di dapur).
- Ekspansi kota dinamis (D8), multi-bahasa.
- Real-time (SSE/WebSocket) untuk chat & status pesanan.
- Integrasi pembukuan sederhana (ekspor ke spreadsheet / aplikasi kasir UMKM).
- Program kemitraan: koperasi/asosiasi catering, dinas koperasi & UMKM untuk onboarding massal.

---

## Saran UI/UX (prinsip desain gaya Apple, diterapkan untuk web)

Diambil dari skill `apple-design` yang dipasang di sesi ini, disesuaikan dengan kondisi kode:

1. **Respons instan.** Tombol `Button`/`SubmitButton` beri umpan balik saat ditekan (`:active { transform: scale(.97) }` 100 ms) dan status *pending* langsung — penting karena semua mutasi lewat Server Action + redirect yang terasa lambat.
2. **Wayfinding.** Setiap layar harus menjawab "Saya di mana, bisa ke mana, bagaimana keluar". Tambahkan **stepper status pesanan** (Permintaan → Dikonfirmasi → Lunas → Disiapkan → Dikirim → Selesai) di halaman penawaran/booking, dengan langkah aktif yang jelas.
3. **Empat jenis feedback**: status, selesai, peringatan, error. Ganti `?error=` di URL dengan toast + validasi inline (bukan saat submit). Peringatan proaktif: "Kapasitas tersisa 40 pax di tanggal ini".
4. **Label spesifik.** Nama menu navigasi berdasarkan isinya ("Permintaan masuk", "Jadwal produksi") alih-alih istilah umum.
5. **Kesederhanaan, bukan minimalisme.** Tampilkan jalur umum dulu (pilih paket → tanggal → kirim), opsi lanjutan (menu tambahan, catatan) satu tingkat lebih dalam.
6. **Tipografi.** Judul besar `letter-spacing: -0.02em` dan `line-height` rapat; teks badan dekat 0. Gunakan `rem` agar menghormati ukuran teks pengguna.
7. **Material & kedalaman.** Navbar/SideNav lengket dengan `backdrop-filter: blur()` + latar semi-transparan; modal konfirmasi pakai scrim.
8. **Aksesibilitas gerak.** `prefers-reduced-motion` → cross-fade, bukan geser. `prefers-contrast: more` → border tegas.
9. **Konfirmasi hanya untuk yang destruktif.** "Batalkan pesanan" perlu dialog + alasan; aksi lain cukup bisa dibatalkan (undo).
10. **Mobile-first untuk vendor.** Pelaku UMKM mengelola dari HP: tombol aksi utama di zona jempol, tabel pesanan berubah jadi kartu di layar kecil.

---

## Narasi pitching yang didukung kode

| Klaim ke juri | Bukti di kode sekarang | Diperkuat oleh |
|---|---|---|
| "Mencegah overbooking UMKM" | Transaksi + `SELECT … FOR UPDATE` di `domain/booking.ts` | Fase 0 A2 (pelepasan kapasitas otomatis) |
| "Pembayaran aman & tercatat" | Webhook Midtrans ber-signature, idempoten, `PAID` hanya dari sistem | Fase 0 A1, Fase 1 invoice |
| "Membangun kepercayaan pelanggan" | Verifikasi dokumen privat oleh admin, ulasan hanya dari pembeli lunas | Fase 1 badge halal/NIB/PIRT |
| "Produktivitas operasional" | Kapasitas harian, kalender, status produksi, analitik | Fase 1 lembar produksi + HPP |
| "Layanan pelanggan lebih baik" | Chat per pesanan, histori status | Fase 0 notifikasi, Fase 1 WhatsApp |

## Metrik keberhasilan yang bisa ditampilkan

- Waktu dari permintaan → konfirmasi vendor (target < 2 jam dengan notifikasi WA).
- Persentase pesanan dibayar sebelum batas waktu.
- Jumlah overbooking yang dicegah (dicatat saat `CAPACITY_FULL`).
- Margin rata-rata paket setelah kalkulator HPP dipakai.
- Persentase order vendor yang tercatat di CaterHub (online + offline).
