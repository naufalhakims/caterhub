# Changelog

Catatan perubahan per tahap pengembangan. Versi mengikuti milestone roadmap ([ROADMAP_PENGEMBANGAN.md](./ROADMAP_PENGEMBANGAN.md)), bukan rilis npm.

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
