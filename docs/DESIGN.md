# Sistem Desain CaterHub

Bahasa visual diadaptasi dari referensi di folder ini (`videoframe_*.png`): halaman putih bersih, serif display kontras tinggi dengan **kata miring berwarna**, sans humanis untuk teks, CTA pil kuning cerah, panel gradien "buah", dan footer cokelat tua. Prinsip interaksi (umpan balik tekan, reduced-motion, wayfinding) tetap mengikuti [apple-design](./ROADMAP_PENGEMBANGAN.md#saran-uiux-prinsip-desain-gaya-apple-diterapkan-untuk-web).

## Tipografi

| Peran | Font | Pemakaian |
|---|---|---|
| Display | **DM Serif Display** (400, roman + italic) via `next/font` — kelas `font-display` | Semua judul `h1`/`h2`, angka statistik, harga di bar kuning, wordmark |
| Teks | **Figtree** (variable) — default `font-sans` | Paragraf, label, tombol, navigasi |

- Penekanan dalam judul: bungkus kata dengan `<em>` → otomatis miring hijau zaitun. Varian warna: `em-tangerine`, `em-berry`, `em-maroon`, `em-ink`.
  `<h1 className="font-display text-5xl">Sajikan <em>rasa terbaik</em> di <em className="em-ink">setiap</em> acara.</h1>`
- Penekanan serif di dalam paragraf sans: beri kelas `serif-strong` pada paragraf, lalu pakai `<strong>`.
- Font display hanya satu ketebalan; `font-bold` pada `font-display` sengaja dinetralkan (tidak ada faux bold).
- Skala judul halaman: `font-display text-4xl sm:text-5xl text-ink`; judul seksi landing `text-4xl sm:text-5xl` (komponen `SectionHeading`, opsi `dash` untuk tanda "–").

## Warna (token Tailwind)

| Token | Hex | Peran |
|---|---|---|
| `ink` | `#1D1B16` | Teks utama, tombol gelap, chip terpilih |
| `sun-400` / `sun-300` | `#FBE734` / `#FFF06A` | CTA utama, bar harga, item navigasi aktif |
| `brand-*` (zaitun) | `#46521F` (700) | Tautan, kata miring default, ikon sukses |
| `tangerine` | `#EE5A1F` | Titik logo, nomor langkah, badge notifikasi |
| `berry` / `maroon` | `#C8215E` / `#7A2B24` | Kata miring pada panel pink/peach |
| `mint`, `peach`, `blush` | `#DCEFCB`, `#FDDCC0`, `#FDE6EF` | Latar panel & lingkaran kategori |
| `paper` | `#F7F6F1` | Blok inset (rincian nota, info demo) |
| `cocoa` | `#33231A` | Footer |

Gradien panel: hero `from-mint via-[#EEF4B4] to-sun-400`; panel vendor `from-peach via-[#FBD3C4] to-[#F9C6D6]`. Status pesanan (hijau/kuning/merah) tetap memakai warna semantik emerald/amber/red.

## Komponen

- **Button** (`components/ui/Button.tsx`): pil `rounded-full`. Varian `primary` (kuning), `secondary` (outline), `dark`, `danger`, `ghost`; prop `arrow` menambah →. Untuk `<Link>` pakai `buttonLink(variant, extra)`.
- **FormButton / SubmitButton**: status "Memproses…" otomatis untuk Server Action.
- **Card**: `rounded-3xl border-stone-200`, tanpa bayangan; `interactive` untuk kartu yang bisa diklik.
- **VendorCard**: gambar 4:3, nama, rating, lalu **bar harga kuning** (gaya kartu produk referensi).
- **FoodArt**: pengganti foto bila vendor belum mengunggah gambar — latar gradien pastel + ilustrasi makanan, deterministik per nama.
- **Chip filter**: `rounded-full ring-1 ring-stone-300`; terpilih `ring-2 ring-ink`.
- **Logo**: wordmark serif `caterhub.` dengan titik `tangerine`; versi `tone="sun"` di footer.
- **Field**: input `rounded-2xl`, fokus `border-ink` + `ring-sun-200`.

## Tata letak

- Lebar konten `max-w-7xl`; panel hero/gradien `max-w-[88rem]` dengan margin 12–16px dari tepi (efek "kartu besar" seperti referensi), radius `rounded-4xl` (2rem).
- Jarak antarseksi landing `pt-20`–`pt-28`.
- Mobile: hero & formulir menumpuk; chip membungkus; kartu satu kolom.

## Catatan

- Setelah mengubah `tailwind.config.ts`, restart `npm run dev` — dev server Next menyimpan cache config Tailwind.
- Konten tidak mengarang klaim: statistik landing berasal dari API (jumlah vendor terverifikasi, rata-rata rating) atau aturan produk nyata (batas pelunasan 24 jam); testimoni diambil dari ulasan asli.
