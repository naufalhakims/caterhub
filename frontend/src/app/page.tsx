import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { VendorCard } from "@/components/VendorCard";
import { SectionHeading } from "@/components/SectionHeading";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { apiGet } from "@/lib/api";
import type { VendorCardDto } from "@/lib/vendor-types";

const CATEGORIES = [
  { name: "Pernikahan", desc: "Prasmanan & stall 100–1000 pax", mark: "♥" },
  { name: "Korporat", desc: "Rapat, seminar, gathering", mark: "◈" },
  { name: "Ulang Tahun", desc: "Paket intimate 20–150 pax", mark: "✦" },
  { name: "Nasi Kotak", desc: "Harian kantor & hajatan", mark: "▣" },
];

const STEPS = [
  { n: "01", t: "Buat acara", d: "Isi tanggal, lokasi, jumlah tamu, dan budget sekali saja." },
  { n: "02", t: "Bandingkan vendor", d: "Skor rekomendasi dari kapasitas, budget, lokasi, dan rating." },
  { n: "03", t: "Minta penawaran", d: "Sesuaikan paket dan terima rincian harga item per item." },
  { n: "04", t: "Pesan & bayar QRIS", d: "Kapasitas dicek ulang otomatis sebelum pesanan dikunci." },
];

export default async function LandingPage() {
  const all = await apiGet<VendorCardDto[]>("/api/v1/vendors");
  const vendors = all.slice(0, 3);

  return (
    <>
      <Navbar />
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-stone-900 text-white">
          <div className="hero-dots-light absolute inset-0 opacity-60" />
          <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-16 sm:pt-20">
            <div className="animate-rise max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Marketplace + operasional catering UMKM
              </p>
              <h1 className="mt-4 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
                Temukan Catering yang Tepat untuk Acara Anda
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
                Cari, bandingkan, sesuaikan, dan pesan catering dalam satu platform —
                dari acara kantor 50 orang sampai pernikahan 500 tamu.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/events/new"
                  className="rounded-xl bg-white px-6 py-3 font-semibold text-brand-900 shadow-lift transition hover:-translate-y-0.5"
                >
                  Buat Acara
                </Link>
                <Link
                  href="/catering"
                  className="rounded-xl px-6 py-3 font-semibold ring-1 ring-white/40 transition hover:bg-white/10"
                >
                  Jelajahi Catering
                </Link>
              </div>
            </div>

            <form
              action="/catering"
              method="get"
              className="animate-rise relative mt-10 grid max-w-3xl gap-2 rounded-2xl bg-white p-3 text-stone-900 shadow-lift sm:grid-cols-[1fr_1fr_1fr_auto]"
              style={{ animationDelay: "120ms" }}
            >
              <label className="block rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-brand-200">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-stone-400">Tanggal</span>
                <input name="date" type="date" required className="w-full bg-transparent text-sm font-medium outline-none" />
              </label>
              <label className="block rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-brand-200">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-stone-400">Tamu</span>
                <input name="guests" type="number" min={10} required placeholder="250" className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-stone-300" />
              </label>
              <label className="block rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-brand-200">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-stone-400">Budget maks (Rp)</span>
                <RupiahInput name="budgetMax" variant="bare" placeholder="10.000.000" />
              </label>
              <button className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-800">
                Cari catering
              </button>
            </form>
          </div>
        </section>

        {/* STATS STRIP */}
        <section className="border-b border-stone-200/70 bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-3 gap-4 px-4 py-6 text-center">
            {[
              ["5+", "Vendor terverifikasi"],
              ["Surabaya Raya", "Area layanan"],
              ["QRIS", "Pembayaran aman"],
            ].map(([big, small]) => (
              <div key={small}>
                <p className="font-display text-xl font-bold sm:text-2xl">{big}</p>
                <p className="text-xs text-stone-500 sm:text-sm">{small}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CATEGORIES */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeading
            eyebrow="Kategori populer"
            title="Untuk setiap jenis acara"
            hint="Mulai dari paket hemat sampai premium — semua dengan rincian harga transparan per pax."
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <Link
                key={c.name}
                href="/catering"
                className="group rounded-2xl border border-stone-200/80 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-lg text-brand-700 ring-1 ring-brand-100">
                  {c.mark}
                </span>
                <p className="mt-3 font-bold group-hover:text-brand-800">{c.name}</p>
                <p className="text-sm text-stone-500">{c.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-y border-stone-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <SectionHeading eyebrow="Cara kerja" title="Dari acara ke meja prasmanan" />
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="relative rounded-2xl bg-[#FAF7F1] p-5 ring-1 ring-stone-200/70">
                  <p className="font-display text-3xl font-bold text-brand-200">{s.n}</p>
                  <p className="mt-2 font-bold">{s.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-500">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FEATURED VENDORS */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Pilihan teratas"
              title="Vendor favorit pelanggan"
              hint="Diurutkan berdasarkan rating dan ulasan terverifikasi."
            />
            <Link href="/catering" className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50">
              Lihat semua →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((v) => (
              <VendorCard
                key={v.id}
                href={`/catering/${v.id}`}
                v={{
                  id: v.id,
                  businessName: v.businessName,
                  city: v.city,
                  rating: v.rating,
                  reviewCount: v.reviewCount,
                  startingPrice: v.startingPrice,
                  remaining: v.remaining,
                  hasCapacity: v.hasCapacity,
                  description: v.description,
                }}
              />
            ))}
            {vendors.length === 0 && (
              <p className="text-sm text-stone-500">Belum ada vendor terverifikasi. Jalankan seed data.</p>
            )}
          </div>
        </section>

        {/* VENDOR CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-4">
          <div className="relative overflow-hidden rounded-3xl bg-stone-900 px-6 py-10 text-white sm:px-10">
            <div className="hero-dots-light absolute inset-0 opacity-40" />
            <div className="relative max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-200">Untuk UMKM catering</p>
              <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                Berhenti kelola pesanan lewat chat berantakan.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                Terima permintaan penawaran, kirim rincian harga, kelola kapasitas harian dan
                jadwal acara, pantau pendapatan — semua dari satu dashboard. Tanpa spreadsheet.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-white/85 sm:grid-cols-3">
                {["Penawaran digital", "Kapasitas otomatis", "Analitik usaha"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/20 text-xs text-emerald-300">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-stone-900 transition hover:-translate-y-0.5"
              >
                Daftarkan Usaha Anda — gratis
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
