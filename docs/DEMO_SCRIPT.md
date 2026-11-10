# Skrip Demo CaterHub (±8 menit)

Panduan presentasi untuk juri. Semua data berasal dari `npm run db:seed` dan **relatif terhadap hari ini** (H+1, H+3, …), jadi skrip ini tetap berlaku kapan pun seed dijalankan.

## Persiapan (5 menit sebelum tampil)

Demo memakai versi **live**: **https://web-production-240c4.up.railway.app** (Railway; pembayaran Midtrans **sandbox**, WhatsApp sungguhan via Fonnte ke HP vendor demo). Lihat [DEPLOY.md](./DEPLOY.md).

```bash
# Reset data demo di produksi (tanggal pesanan dihitung dari hari seed dijalankan)
railway ssh --service api
npm run db:seed
exit
```

Versi lokal tetap bisa dipakai sebagai cadangan: `npm run db:seed` lalu `npm run dev:all` (API :4000 + web :3000; pembayaran & WA memakai mock).

- Pastikan device Fonnte **connected** dan HP vendor demo (nomor `DEMO_VENDOR_WHATSAPP`) ada di dekat Anda — tunjukkan WA yang masuk ke juri.
- Buka tab **QRIS Simulator Midtrans**: https://simulator.sandbox.midtrans.com/v2/qris/index (halaman bayar juga menautkannya).
- Buka 3 jendela/profil browser terpisah (agar sesi tidak saling menimpa):
  | Jendela | Akun | Peran |
  |---|---|---|
  | A | `pelanggan@demo.id` | Pelanggan (Budi Santoso) |
  | B | `vendor1@demo.id` | Vendor UMKM (Dapur Nusantara) |
  | C | `admin@caterhub.id` | Admin platform |
  Sandi semua akun: `demo1234`. Akun cadangan: `andi@demo.id` (punya penawaran menunggu keputusan), `sari@demo.id` (punya pesanan menunggu bayar).
- Jendela B: buka tab **Produksi** dan pilih chip tanggal **H+3** sebelumnya agar siap.

## Cerita yang dibawakan

> "Catering UMKM masih mengelola pesanan lewat WhatsApp dan buku tulis: harga dinego di chat, kapasitas dapur dikira-kira, belanja bahan tanpa hitungan, dan nota ditulis tangan. CaterHub mendigitalkan alur itu dari permintaan pelanggan sampai lembar kerja dapur — tanpa memaksa UMKM meninggalkan WhatsApp."

## Alur

### 1. Pelanggan menemukan & memesan — 1,5 menit (Jendela A)
1. **Beranda** → tunjukkan statistik nyata (jumlah vendor terverifikasi) dan pencarian tanggal/jam/tamu/budget.
2. Cari dengan tanggal ±2 minggu lagi, 150 tamu → kartu vendor menampilkan **sisa kapasitas** dan **alasan rekomendasi**.
3. Tekan **📍 Dekat lokasi saya** (atau buka URL dengan `?lat=-7.2650&lng=112.7450`) → kartu vendor menampilkan **±km & ongkir ke lokasi Anda**; vendor di luar radius ditandai.
4. Buka **Dapur Nusantara** → tunjukkan cover, logo, foto menu & paket → pilih paket, centang **menu tambahan**, geser **pin titik antar** di peta; tunjukkan **Subtotal + Ongkir (±km) = Estimasi total** berubah langsung. (Tidak perlu mengirim — permintaan Budi untuk pernikahan sudah ada.)
5. Buka **Dasbor** → permintaan "Pernikahan Budi & Sari" berstatus *Menunggu konfirmasi* (ongkir sudah terhitung dari jarak).

**Pesan:** pelanggan langsung tahu vendor mana yang *masih muat* di tanggalnya — tidak perlu chat satu per satu.

### 2. Vendor menerima & menegosiasi — 2 menit (Jendela B)
1. **Lonceng notifikasi** (badge) → "Permintaan pesanan baru". Sebut: *event penting juga dikirim ke WhatsApp vendor* (dibuktikan langsung di langkah 3).
2. **Permintaan masuk** → ada tiga jenis tugas: *Revisi diminta*, *Permintaan baru*, *Menunggu keputusan pelanggan*.
3. Buka **Rapat Kerja Q4 PT Maju Jaya** (revisi): pelanggan minta ganti rendang & gratis ongkir. Di **Perbarui penawaran**: ubah baris, set ongkir 0 → total terhitung ulang → **Kirim revisi**.
4. Buka **Pernikahan Budi & Sari** → kolom ongkir **sudah terisi dari tarif** (±km) — ubah bila perlu (tercatat di riwayat) → **Konfirmasi pesanan** → pesanan terbentuk, **kapasitas tanggal itu terkunci**, nomor invoice terbit. Tunjukkan **Profil → Lokasi dapur & tarif ongkir** (Rp15.000 s.d. 3 km, +Rp4.000/km).

**Pesan:** negosiasi yang biasanya berceceran di chat kini tercatat, berversi, dan berakhir di satu nota.

### 3. Pelanggan membayar — 1,5 menit (Jendela A)
1. Lonceng → "Pesanan dikonfirmasi vendor" → **Bayar lunas via QRIS** → halaman bayar dengan masa berlaku dan label **Mode uji (sandbox)**.
2. **Bayar QRIS via Midtrans** → halaman Snap menampilkan QRIS → klik kanan QR → *Copy image address* → tab **QRIS Simulator** → tempel → *Scan QR* → *Pay*.
3. Kembali ke halaman bayar → dalam ±5 detik berubah **Lunas** (webhook Midtrans, status diverifikasi ke server Midtrans) → **HP vendor menerima WhatsApp "Pembayaran lunas diterima"** — tunjukkan ke juri.
   - Tekankan: mode sandbox, tidak ada uang sungguhan; **jangan memindai QR dengan e-wallet asli**.
4. **Lihat kuitansi** → nomor `INV/DN/…`, cap **LUNAS**, tombol **Cetak / Unduh PDF**.
5. Dasbor → pesanan **"Pengajian Bulanan Masjid Al-Ikhlas"** (sedang diantar hari ini) → kartu **"Pesanan sudah sampai?"** → **Ya, pesanan sudah diterima** → pesanan selesai dan form ulasan langsung muncul.

**Pesan (progres otomatis):** vendor tidak perlu mengklik tiap tahap — masak dimulai otomatis di hari acara, vendor cukup sekali "Berangkat antar", pelanggan yang menutup pesanan (atau otomatis 24 jam setelah acara).

**Pesan:** pelanggan korporat butuh kuitansi resmi untuk reimburse — otomatis.

### 4. Dapur yang terencana — 2 menit (Jendela B)
1. **Produksi** (tanggal H+3): 2 pesanan lunas (satu dari aplikasi, satu **offline** dari WA) → **porsi per menu**, **daftar belanja** (kg/liter/pcs + estimasi biaya), **jadwal kirim**; pesanan belum bayar terpisah sebagai *tentatif*. Tunjukkan banner **Mulai masak semua** (otomatis 00:00 hari acara) dan **Cetak lembar** untuk ditempel di dapur. Tombol **Berangkat antar** baru muncul mulai **H-1 acara** — di menu **Pesanan**, pesanan H+3 menampilkan keterangan "tersedia mulai H-1" (mencegah pesanan ditandai selesai sebelum acaranya).
2. **Bahan & HPP → Paket & margin**: HPP dan margin setiap paket dari resep nyata.
3. Simulasi **harga daging sapi naik**: tab **Bahan baku** → ubah *Daging sapi* dari Rp130.000 menjadi Rp160.000/kg → kembali ke **Paket & margin** → margin paket berisi rendang langsung turun.

**Pesan:** UMKM tahu untung-ruginya per porsi sebelum menerima pesanan — bukan setelah acara.

### 5. Pesanan dari WhatsApp tetap tercatat — 45 detik (Jendela B)
1. **Pesanan → Catat pesanan offline**: isi nama "Bu Lina", tanggal H+3, 50 porsi, paket Hemat, **Sudah lunas (tunai)** → simpan.
2. Kembali ke **Produksi H+3** → porsi & belanja bertambah; kapasitas tanggal itu ikut berkurang.

**Pesan:** CaterHub menjadi satu-satunya sumber kebenaran operasional, bukan sekadar kanal penjualan tambahan.

### 6. Platform yang bertanggung jawab — 45 detik (Jendela C)
1. **Kotak keluar WA** → pesan-pesan yang dikirim sistem (permintaan baru, revisi, pembayaran lunas, pembatalan) lengkap dengan nomor tujuan dan ✓✓. Pesan "Pembayaran lunas diterima" dari langkah 3 terkirim sungguhan via **fonnte**; pesan ke nomor selain vendor demo tercatat **Dilewati** (pengaman agar nomor karangan di data demo tidak dikirimi).
2. **Pesanan → Menunggu refund** → "Reuni SMA Angkatan 2010" dibatalkan pelanggan setelah lunas → **Tandai sudah dikembalikan** (pelanggan menerima notifikasi + WA).
3. **Dashboard** → GMV, vendor terverifikasi, antrean verifikasi.

**Pesan:** uang pelanggan aman — pembatalan setelah lunas wajib refund, pesanan tak dibayar otomatis melepas jadwal vendor.

## Penutup (30 detik)

> "Untuk UMKM catering, CaterHub berarti lebih sedikit chat bolak-balik, tidak ada lagi overbooking, belanja bahan yang terukur, dan nota profesional — semuanya dari ponsel. Langkah berikutnya: WhatsApp Cloud API resmi, pencairan dana otomatis ke vendor, dan aplikasi PWA untuk dapur."

## Bila ada pertanyaan teknis

| Pertanyaan | Jawaban singkat & bukti |
|---|---|
| Bagaimana mencegah overbooking? | Kapasitas dikunci dalam transaksi dengan `SELECT … FOR UPDATE` (`backend/src/domain/booking.ts`). |
| Ongkir dihitung bagaimana? | Tarif vendor: dasar untuk N km pertama + per km (dibulatkan ke atas), radius maks.; jarak = garis lurus × 1,3 sebagai perkiraan jalan, tanpa API berbayar (`domain/delivery.ts`). Vendor tetap bisa menyesuaikan saat konfirmasi. |
| Vendor harus update status satu per satu? | Tidak: masak otomatis 00:00 hari acara, vendor hanya "Berangkat antar" (tersedia mulai H-1), pelanggan konfirmasi terima, selesai otomatis 24 jam setelah acara (`domain/progress.ts`). |
| Bagaimana jika pelanggan tidak bayar? | Batas pelunasan 24 jam (maks. H-0 WIB); pengingat WA 3 jam sebelumnya; lewat batas → batal otomatis & kapasitas dilepas (`domain/expiry.ts`). |
| Aman dari pembayaran ganda? | Satu tagihan aktif per pesanan; webhook Midtrans diverifikasi (signature, atau status ditanyakan langsung ke Midtrans) & idempoten; nominal harus sama dengan tagihan; pembayaran telat untuk pesanan batal otomatis menjadi refund. |
| Pembayarannya sungguhan? | Midtrans Snap **sandbox** (QRIS) end-to-end; pindah ke production cukup ganti server key & `MIDTRANS_IS_PRODUCTION`. Dana masuk ke merchant CaterHub; pencairan ke vendor adalah rencana lanjutan. |
| WhatsApp-nya sungguhan? | Ya — *transactional outbox* + provider **Fonnte** ke HP vendor demo; nomor lain dilewati oleh pengaman. Provider resmi (WhatsApp Cloud API) cukup satu kelas baru (`domain/whatsapp.ts`). |
| Data demo dari mana? | Seed (`backend/prisma/seed.ts`); foto landing dari Unsplash, foto menu/paket/vendor demo dari Wikimedia Commons (lihat [ASSET_CREDITS.md](./ASSET_CREDITS.md)); nama vendor, ulasan & angka statistik berasal dari data seed, bukan klaim pasar. |

## Pemulihan cepat saat demo

- Data berantakan / ingin mengulang: jalankan seed (lihat Persiapan) lalu muat ulang halaman (sesi login tetap berlaku).
- Midtrans bermasalah: di Railway service `api` ubah `PAYMENT_PROVIDER=mock` → Deploy (±2 menit) → tombol **Simulasikan bayar** muncul lagi.
- Fonnte bermasalah (device terputus/kuota): ubah `WHATSAPP_PROVIDER=mock` → Deploy; pesan tetap tampil di Kotak keluar WA.
- Notifikasi Midtrans terlewat: dashboard sandbox Midtrans → transaksi → *Resend notification*.
- Warna/halaman tampak salah setelah mengubah config: restart `npm run dev:all`.
- Pesan WA tidak muncul: pastikan API sudah di-restart setelah update (dispatcher berjalan tiap 5 detik); halaman Kotak keluar juga memicu pengiriman.
