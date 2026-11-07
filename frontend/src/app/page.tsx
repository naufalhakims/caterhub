import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { VendorCard } from "@/components/VendorCard";
import { SectionHeading } from "@/components/SectionHeading";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { ArrowRight, buttonLink } from "@/components/ui/Button";
import { apiGet } from "@/lib/api";
import type { VendorCardDto } from "@/lib/vendor-types";

type VendorReview = { id: string; rating: number; comment: string | null; customerName: string | null };
type VendorDetail = { id: string; businessName: string; reviews: VendorReview[] };

// Foto: Unsplash License (lihat docs/ASSET_CREDITS.md).
const OCCASIONS = [
  { name: "Pernikahan", hint: "100–1000 pax", img: "/landing/occ-pernikahan.jpg", alt: "Meja prasmanan dengan chafing dish", bg: "bg-blush", offset: "sm:mt-16" },
  { name: "Korporat", hint: "Rapat & seminar", img: "/landing/occ-korporat.jpg", alt: "Peserta acara kantor", bg: "bg-[#DCE3FF]", offset: "sm:mt-6" },
  { name: "Nasi Kotak", hint: "Harian & hajatan", img: "/landing/occ-nasi-kotak.jpg", alt: "Nasi kotak dengan lauk dan sayur", bg: "bg-mint", offset: "" },
  { name: "Ulang Tahun", hint: "20–150 pax", img: "/landing/occ-ulang-tahun.jpg", alt: "Kue ulang tahun merah muda", bg: "bg-peach", offset: "sm:mt-6" },
  { name: "Syukuran", hint: "Tumpeng & prasmanan", img: "/landing/occ-syukuran.jpg", alt: "Nasi tumpeng kuning", bg: "bg-sun-200", offset: "sm:mt-16" },
];

const CITIES = ["Surabaya", "Sidoarjo", "Gresik"];

const STEPS = [
  { t: "Cari vendor", d: "Isi tanggal, jam, dan jumlah tamu. Kami tampilkan yang dapurnya masih muat." },
  { t: "Kirim permintaan", d: "Pilih paket dan kirim — tidak perlu membuat acara lebih dulu." },
  { t: "Vendor konfirmasi", d: "Ongkir dan biaya lain masuk ke nota, total dikunci sebelum bayar." },
  { t: "Bayar & nikmati", d: "Lunas via QRIS, pantau status sampai makanan tiba, lalu beri ulasan." },
];

async function loadReviews(vendors: VendorCardDto[]) {
  const details = await Promise.all(
    vendors.slice(0, 4).map((v) => apiGet<VendorDetail>(`/api/v1/vendors/${v.id}`).catch(() => null)),
  );
  return details
    .flatMap((d) => (d ? d.reviews.filter((r) => r.comment).map((r) => ({ ...r, vendor: d.businessName })) : []))
    .slice(0, 3);
}

export default async function LandingPage() {
  const all = await apiGet<VendorCardDto[]>("/api/v1/vendors");
  const featured = all.slice(0, 4);
  const reviews = await loadReviews(all);
  const rated = all.filter((v) => v.reviewCount > 0);
  const avgRating = rated.length ? rated.reduce((s, v) => s + v.rating, 0) / rated.length : null;

  return (
    <>
      <Navbar />
      <main>
        {/* HERO — panel gradien mint → kuning */}
        <section className="px-3 pt-3 sm:px-4">
          <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-4xl bg-gradient-to-br from-mint via-[#EEF4B4] to-sun-400">
            <div className="grid items-center gap-8 px-6 pb-8 pt-12 sm:px-12 lg:grid-cols-[1.15fr_1fr_0.55fr] lg:pb-12 lg:pt-16">
              <div className="animate-rise">
                <h1 className="font-display text-[3.1rem] leading-[1.02] text-ink sm:text-7xl">
                  Sajikan <em>rasa terbaik</em> di <em className="em-ink">setiap</em> acara.
                </h1>
                <p className="serif-strong mt-6 max-w-md text-[17px] leading-relaxed text-stone-800">
                  Pesan catering dari <strong>dapur UMKM</strong> terverifikasi di Surabaya Raya — dengan{" "}
                  <strong>nota transparan</strong> dan kapasitas yang <strong>pasti muat</strong>.
                </p>
                <Link href="/catering" className={buttonLink("primary", "mt-8 !px-7 !py-3.5 !text-base shadow-[0_8px_20px_-8px_rgba(29,27,22,.35)]")}>
                  Cari Catering
                  <ArrowRight className="ml-6" />
                </Link>
              </div>

              <div className="relative mx-auto w-full max-w-xl lg:max-w-sm">
                <div className="relative aspect-[16/11] overflow-hidden rounded-4xl shadow-[0_30px_60px_-30px_rgba(29,27,22,.55)] ring-8 ring-white/60 lg:aspect-[4/5] lg:-rotate-2">
                  <Image
                    src="/landing/hero-spread.jpg"
                    alt="Hidangan Nusantara: sate, rendang, nasi, dan sayur di atas meja"
                    fill
                    priority
                    sizes="(min-width: 1024px) 384px, 92vw"
                    className="object-cover"
                  />
                </div>
                <span className="absolute -bottom-4 left-4 rotate-3 rounded-2xl lg:-left-6 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-lift">
                  Masakan rumahan, <span className="font-display text-base text-brand-700">porsi acara</span>
                </span>
              </div>

              <div className="flex flex-row items-end justify-between gap-6 lg:h-full lg:flex-col lg:items-center lg:justify-between lg:text-center">
                <div className="hidden lg:block">
                  <span className="relative mx-auto block h-24 w-24 overflow-hidden rounded-full ring-4 ring-white/70">
                    <Image src="/landing/hero-sate.jpg" alt="Sate dan lauk khas Indonesia" fill sizes="96px" className="object-cover" />
                  </span>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-700">Dari dapur UMKM</p>
                </div>
                <div>
                  <p className="font-display text-6xl text-ink sm:text-7xl">{all.length}</p>
                  <p className="mt-1 text-sm font-medium text-stone-800">
                    Vendor catering
                    <br />
                    terverifikasi
                  </p>
                </div>
                {avgRating != null && (
                  <div className="lg:hidden">
                    <p className="font-display text-6xl text-ink">{avgRating.toFixed(1)}</p>
                    <p className="mt-1 text-sm font-medium text-stone-800">Rata-rata rating</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pencarian cepat */}
            <form
              action="/catering"
              method="get"
              className="relative mx-4 mb-4 grid gap-1 rounded-3xl bg-white p-2 text-ink shadow-lift sm:mx-12 sm:mb-10 sm:grid-cols-[1fr_0.8fr_1fr_1.1fr_auto] sm:rounded-full"
            >
              {[
                ["Tanggal acara", <input key="d" name="date" type="date" required className="w-full bg-transparent text-sm font-medium outline-none" />],
                ["Jam", <input key="t" name="time" type="time" required className="w-full bg-transparent text-sm font-medium outline-none" />],
                ["Jumlah tamu", <input key="g" name="guests" type="number" min={10} required placeholder="250 pax" className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-stone-300" />],
                ["Budget maks (Rp)", <RupiahInput key="b" name="budgetMax" variant="bare" placeholder="10.000.000" />],
              ].map(([label, control]) => (
                <label
                  key={label as string}
                  className="block rounded-full px-5 py-2 transition-colors focus-within:bg-paper hover:bg-paper"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</span>
                  {control}
                </label>
              ))}
              <button className={buttonLink("dark", "!py-3.5 sm:!px-7")}>Cari catering</button>
            </form>
          </div>
        </section>

        {/* PILIHAN VENDOR */}
        <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading title={<><em className="em-ink">Temukan</em> catering pilihan</>} dash />
            <div className="flex flex-wrap gap-2">
              <Link href="/catering" className="rounded-full px-5 py-2.5 text-sm font-semibold ring-2 ring-inset ring-ink transition-colors hover:bg-stone-50">
                Rating tertinggi
              </Link>
              {CITIES.map((c) => (
                <Link
                  key={c}
                  href={`/catering?city=${c}`}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-inset ring-stone-300 transition-colors hover:ring-ink"
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((v) => (
              <VendorCard key={v.id} href={`/catering/${v.id}`} v={v} />
            ))}
            {featured.length === 0 && (
              <p className="text-sm text-stone-500">Belum ada vendor terverifikasi. Jalankan seed data.</p>
            )}
          </div>
        </section>

        {/* JENIS ACARA — lingkaran warna */}
        <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6">
          <SectionHeading
            align="center"
            title={
              <>
                Satu platform untuk <span aria-hidden className="inline-block -translate-y-1 not-italic">🍽️</span>{" "}
                <em className="em-tangerine">setiap</em> jenis acara
              </>
            }
          />
          <div className="mt-14 grid grid-cols-2 items-start gap-x-4 gap-y-10 sm:grid-cols-5">
            {OCCASIONS.map((o) => (
              <Link key={o.name} href="/catering" className={`group text-center ${o.offset}`}>
                <span
                  className={`relative mx-auto block aspect-square w-[78%] rounded-full ${o.bg} p-2.5 transition-transform duration-500 ease-fluid group-hover:-translate-y-1 group-active:scale-95`}
                >
                  <span className="relative block h-full w-full overflow-hidden rounded-full">
                    <Image src={o.img} alt={o.alt} fill sizes="(min-width: 640px) 18vw, 40vw" className="object-cover transition-transform duration-700 ease-fluid group-hover:scale-105" />
                  </span>
                </span>
                <p className="mt-4 font-display text-2xl text-ink">{o.name}</p>
                <p className="text-sm text-stone-500">{o.hint}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* UNTUK UMKM — panel peach → pink */}
        <section className="px-3 pt-28 sm:px-4">
          <div className="relative mx-auto grid max-w-[88rem] items-center gap-8 overflow-hidden rounded-4xl bg-gradient-to-r from-peach via-[#FBD3C4] to-[#F9C6D6] px-6 py-12 sm:px-12 lg:grid-cols-[1.2fr_1fr_0.6fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-maroon/80">Untuk UMKM catering</p>
              <h2 className="mt-3 font-display text-5xl text-maroon sm:text-6xl">
                Kelola pesanan <em className="em-maroon">tanpa</em> chat berantakan
              </h2>
              <p className="serif-strong mt-5 max-w-md text-[17px] leading-relaxed text-stone-800">
                Terima permintaan, kunci <strong>nota</strong>, atur <strong>kapasitas harian</strong>, dan pantau{" "}
                <strong>pendapatan</strong> — semuanya dari satu dashboard.
              </p>
              <Link href="/register" className={buttonLink("primary", "mt-8 !px-7 !py-3.5 !text-base")}>
                Daftarkan Usaha
                <ArrowRight className="ml-6" />
              </Link>
            </div>
            <div className="relative h-56 overflow-hidden rounded-4xl ring-8 ring-white/50 sm:h-72 lg:h-80 lg:rotate-2">
              <Image
                src="/landing/vendor-chef.jpg"
                alt="Juru masak menyiapkan hidangan di dapur"
                fill
                sizes="(min-width: 1024px) 30vw, 92vw"
                className="object-cover"
              />
            </div>
            <div className="lg:text-center">
              <p className="font-display text-6xl text-ink sm:text-7xl">24 jam</p>
              <p className="mt-1 text-sm font-medium text-stone-800">
                Batas pelunasan — jadwal
                <br className="hidden lg:block" /> dilepas otomatis bila tak dibayar
              </p>
            </div>
          </div>
        </section>

        {/* CARA KERJA */}
        <section id="cara-kerja" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-28 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <SectionHeading
                title={
                  <>
                    Dari <em>permintaan</em> sampai meja prasmanan
                  </>
                }
                hint="Empat langkah, satu nota, tanpa bolak-balik konfirmasi lewat chat."
              />
              <div className="relative mt-8 hidden aspect-[10/7] overflow-hidden rounded-4xl lg:block">
                <Image
                  src="/landing/steps-table.jpg"
                  alt="Meja makan dengan aneka hidangan Indonesia dilihat dari atas"
                  fill
                  sizes="(min-width: 1024px) 34vw, 0px"
                  className="object-cover"
                />
              </div>
            </div>
            <ol className="grid content-start gap-x-8 gap-y-10 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.t} className="border-t border-stone-200 pt-5">
                  <p className="font-display text-5xl text-tangerine">0{i + 1}</p>
                  <p className="mt-3 text-lg font-semibold text-ink">{s.t}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ULASAN NYATA — panel pink */}
        {reviews.length > 0 && (
          <section className="px-3 pt-28 sm:px-4">
            <div className="mx-auto max-w-[88rem] rounded-4xl bg-blush px-5 pb-12 pt-10 sm:px-10">
              <p className="text-center text-4xl" aria-hidden>
                😍
              </p>
              <h2 className="mt-3 text-center font-display text-5xl text-ink sm:text-6xl">
                Pelanggan <em className="em-berry">suka</em> hasilnya
              </h2>
              <div className="mt-10 grid gap-5 lg:grid-cols-3">
                {reviews.map((r) => (
                  <figure key={r.id} className="flex flex-col rounded-3xl bg-white p-7">
                    <p className="font-display text-2xl text-ink">{r.vendor}</p>
                    <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-stone-700">“{r.comment}”</blockquote>
                    <figcaption className="mt-6 flex items-center justify-between border-t border-stone-100 pt-5">
                      <span className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-sun-300 font-display text-lg text-ink">
                          {(r.customerName ?? "P").charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold text-ink">{r.customerName ?? "Pelanggan"}</span>
                      </span>
                      <span className="rounded-lg bg-paper px-2.5 py-1 text-sm font-semibold text-ink">
                        {r.rating.toFixed(1)} <span className="text-amber-500">★</span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
