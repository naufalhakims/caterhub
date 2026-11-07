# Skrip Demo CaterHub (±8 menit)

Panduan presentasi untuk juri. Semua data berasal dari `npm run db:seed` dan **relatif terhadap hari ini** (H+1, H+3, …), jadi skrip ini tetap berlaku kapan pun seed dijalankan.

## Persiapan (5 menit sebelum tampil)

```bash
npm run db:seed        # reset data demo — aman diulang; katalog & gambar tetap
npm run dev:all        # API :4000 + web :3000 (restart bila sudah berjalan)
```

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
3. Buka **Dapur Nusantara** → pilih paket, centang **menu tambahan**; tunjukkan **estimasi harga berubah langsung**. (Tidak perlu mengirim — permintaan Budi untuk pernikahan sudah ada.)
4. Buka **Dasbor** → permintaan "Pernikahan Budi & Sari" berstatus *Menunggu konfirmasi*.

**Pesan:** pelanggan langsung tahu vendor mana yang *masih muat* di tanggalnya — tidak perlu chat satu per satu.

### 2. Vendor menerima & menegosiasi — 2 menit (Jendela B)
1. **Lonceng notifikasi** (badge) → "Permintaan pesanan baru". Sebut: *pesan yang sama juga dikirim ke WhatsApp vendor*.
2. **Permintaan masuk** → ada tiga jenis tugas: *Revisi diminta*, *Permintaan baru*, *Menunggu keputusan pelanggan*.
3. Buka **Rapat Kerja Q4 PT Maju Jaya** (revisi): pelanggan minta ganti rendang & gratis ongkir. Di **Perbarui penawaran**: ubah baris, set ongkir 0 → total terhitung ulang → **Kirim revisi**.
4. Buka **Pernikahan Budi & Sari** → **Konfirmasi pesanan** dengan ongkir Rp150.000 → pesanan terbentuk, **kapasitas tanggal itu terkunci**, nomor invoice terbit.

**Pesan:** negosiasi yang biasanya berceceran di chat kini tercatat, berversi, dan berakhir di satu nota.

### 3. Pelanggan membayar — 1 menit (Jendela A)
1. Lonceng → "Pesanan dikonfirmasi vendor" → **Bayar lunas via QRIS** → QR asli (mock) dengan masa berlaku.
2. Klik **Simulasikan bayar** → status **Lunas**, stepper maju.
3. **Lihat kuitansi** → nomor `INV/DN/…`, cap **LUNAS**, tombol **Cetak / Unduh PDF**.

**Pesan:** pelanggan korporat butuh kuitansi resmi untuk reimburse — otomatis.

### 4. Dapur yang terencana — 2 menit (Jendela B)
1. **Produksi** (tanggal H+3): 2 pesanan lunas (satu dari aplikasi, satu **offline** dari WA) → **porsi per menu**, **daftar belanja** (kg/liter/pcs + estimasi biaya), **jadwal kirim**; pesanan belum bayar terpisah sebagai *tentatif*. Tunjukkan **Cetak lembar** untuk ditempel di dapur.
2. **Bahan & HPP → Paket & margin**: HPP dan margin setiap paket dari resep nyata.
3. Simulasi **harga daging sapi naik**: tab **Bahan baku** → ubah *Daging sapi* dari Rp130.000 menjadi Rp160.000/kg → kembali ke **Paket & margin** → margin paket berisi rendang langsung turun.

**Pesan:** UMKM tahu untung-ruginya per porsi sebelum menerima pesanan — bukan setelah acara.

### 5. Pesanan dari WhatsApp tetap tercatat — 45 detik (Jendela B)
1. **Pesanan → Catat pesanan offline**: isi nama "Bu Lina", tanggal H+3, 50 porsi, paket Hemat, **Sudah lunas — tunai** → simpan.
2. Kembali ke **Produksi H+3** → porsi & belanja bertambah; kapasitas tanggal itu ikut berkurang.

**Pesan:** CaterHub menjadi satu-satunya sumber kebenaran operasional, bukan sekadar kanal penjualan tambahan.

### 6. Platform yang bertanggung jawab — 45 detik (Jendela C)
1. **Kotak keluar WA** → pesan-pesan yang dikirim sistem (permintaan baru, revisi, pembayaran lunas, pembatalan) lengkap dengan nomor tujuan dan ✓✓.
2. **Pesanan → Menunggu refund** → "Reuni SMA Angkatan 2010" dibatalkan pelanggan setelah lunas → **Tandai sudah dikembalikan** (pelanggan menerima notifikasi + WA).
3. **Dashboard** → GMV, vendor terverifikasi, antrean verifikasi.

**Pesan:** uang pelanggan aman — pembatalan setelah lunas wajib refund, pesanan tak dibayar otomatis melepas jadwal vendor.

## Penutup (30 detik)

> "Untuk UMKM catering, CaterHub berarti lebih sedikit chat bolak-balik, tidak ada lagi overbooking, belanja bahan yang terukur, dan nota profesional — semuanya dari ponsel. Langkah berikutnya: provider WhatsApp asli, pencairan dana otomatis, dan aplikasi PWA untuk dapur."

## Bila ada pertanyaan teknis

| Pertanyaan | Jawaban singkat & bukti |
|---|---|
| Bagaimana mencegah overbooking? | Kapasitas dikunci dalam transaksi dengan `SELECT … FOR UPDATE` (`backend/src/domain/booking.ts`). |
| Bagaimana jika pelanggan tidak bayar? | Batas pelunasan 24 jam (maks. H-0 WIB); pengingat WA 3 jam sebelumnya; lewat batas → batal otomatis & kapasitas dilepas (`domain/expiry.ts`). |
| Aman dari pembayaran ganda? | Satu tagihan aktif per pesanan, webhook Midtrans diverifikasi signature & idempoten; pembayaran telat untuk pesanan batal otomatis menjadi refund. |
| WhatsApp-nya sungguhan? | Arsitektur *transactional outbox* sudah final; saat ini adapter **mock** — provider asli (Fonnte/WhatsApp Cloud API) cukup satu kelas baru (`domain/whatsapp.ts`). |
| Data demo dari mana? | Seed (`backend/prisma/seed.ts`); foto landing dari Unsplash (lihat [ASSET_CREDITS.md](./ASSET_CREDITS.md)); ulasan & angka statistik berasal dari data seed, bukan klaim pasar. |

## Pemulihan cepat saat demo

- Data berantakan / ingin mengulang: `npm run db:seed` lalu muat ulang halaman (sesi login tetap berlaku).
- Warna/halaman tampak salah setelah mengubah config: restart `npm run dev:all`.
- Pesan WA tidak muncul: pastikan API sudah di-restart setelah update (dispatcher berjalan tiap 5 detik); halaman Kotak keluar juga memicu pengiriman.
