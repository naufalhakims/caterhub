# Dokumentasi CaterHub

Dokumentasi ini disusun dari **pembacaan langsung kode sumber** (commit `73b8d42`, 7 November 2026), bukan dari README lama. Bila ada perbedaan antara dokumen lain (README root, `CATERHUB_CONTEXT.md`, `CLAUDE_CODE_PROMPT.md`) dan dokumen di folder ini, anggap kode — dan dokumen di sini — sebagai acuan.

| Dokumen | Isi |
|---|---|
| [ANALISIS_CODEBASE.md](./ANALISIS_CODEBASE.md) | Kondisi project saat ini: arsitektur, modul, model data, mesin status, alur bisnis, peta endpoint ↔ halaman, kualitas & pengujian. |
| [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) | Apa yang kurang: bug/risiko logika bisnis, fitur yang setengah jadi, celah keamanan, utang teknis, ketidaksesuaian dengan narasi produk. Diberi prioritas. |
| [ROADMAP_PENGEMBANGAN.md](./ROADMAP_PENGEMBANGAN.md) | Rencana pengembangan bertahap dengan fokus tema hackathon **digitalisasi UMKM**: perbaikan pra-demo, fitur pembeda, arah jangka panjang, dan saran UI/UX. |
| [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) | Skrip presentasi ±8 menit untuk juri: persiapan akun, alur per peran, jawaban pertanyaan teknis. |
| [CHANGELOG.md](./CHANGELOG.md) | Catatan versi per tahap (v0.1 baseline → versi terbaru). Mulai dari sini untuk melihat perubahan terakhir. |
| [DESIGN.md](./DESIGN.md) | Sistem desain UI: tipografi serif + italic berwarna, palet, komponen, tata letak (mengikuti referensi `videoframe_*.png`). |
| [BACKEND_SPLIT.md](./BACKEND_SPLIT.md) | Catatan keputusan pemisahan frontend Next.js ↔ backend Express (dokumen lama, masih relevan). |

## Ringkasan satu paragraf

CaterHub adalah marketplace + alat operasional untuk UMKM catering (Surabaya–Sidoarjo–Gresik). Pelanggan mencari vendor berdasarkan tanggal, jumlah tamu, kota, dan budget; mengirim **permintaan pesanan** untuk satu paket; vendor **mengonfirmasi** sambil menambahkan ongkir/biaya layanan/diskon; pelanggan **membayar lunas** via QRIS (mock atau Midtrans); vendor memajukan status produksi; pelanggan memberi ulasan. Admin memverifikasi vendor lewat dokumen privat. Fondasinya sudah solid (transaksi kapasitas dengan row lock, validasi upload magic-bytes, webhook ber-signature, 71 unit test lulus, typecheck bersih), tetapi beberapa fitur yang ditulis di backend belum punya UI (notifikasi, penawaran vendor/revisi), dan ada beberapa celah logika uang & kapasitas yang perlu ditutup sebelum demo.
