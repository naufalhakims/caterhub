import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { VendorCard } from "@/components/VendorCard";
import { searchVendors } from "@/server/marketplace";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { NearMeButton } from "@/components/NearMeButton";
import { Footer } from "@/components/Footer";
import { buttonLink } from "@/components/ui/Button";

export default async function CateringPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const results = await searchVendors(searchParams);
  const located = !!(searchParams.lat && searchParams.lng);
  const showReco = !!(searchParams.date || searchParams.time || searchParams.guests || searchParams.budgetMax || located);
  const pinParams: Record<string, string> = located ? { lat: searchParams.lat!, lng: searchParams.lng! } : {};

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
          {showReco ? "Rekomendasi terpersonalisasi" : "Marketplace"}
        </p>
        <h1 className="mt-2 font-display text-5xl text-ink sm:text-6xl">
          {showReco ? (
            <>
              Pilihan <em>terbaik</em> untuk acara Anda
            </>
          ) : (
            <>
              <em className="em-ink">Jelajahi</em> catering UMKM <span className="text-stone-400">–</span>
            </>
          )}
        </h1>
        {showReco && (searchParams.date || searchParams.guests) && (
          <p className="mt-3 text-[15px] text-stone-600">
            {searchParams.guests ? `${searchParams.guests} tamu` : ""}
            {searchParams.guests && searchParams.date ? " · " : ""}
            {searchParams.date ? `tanggal ${searchParams.date}` : ""}
            {searchParams.time ? ` pukul ${searchParams.time}` : ""}
            {searchParams.budgetMax ? ` · budget maks Rp${Number(searchParams.budgetMax).toLocaleString("id-ID")}` : ""}
          </p>
        )}

        <form
          action="/catering"
          method="get"
          className="mt-8 rounded-4xl bg-gradient-to-r from-mint via-[#F1F5C4] to-sun-200 p-3 sm:p-4"
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.85fr_1fr_1fr_auto]">
            <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Cari nama catering…" aria-label="Cari catering" className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-ink" />
            <select name="city" defaultValue={searchParams.city ?? ""} aria-label="Kota" className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-ink">
              <option value="">Semua kota</option>
              <option value="Surabaya">Surabaya</option>
              <option value="Sidoarjo">Sidoarjo</option>
              <option value="Gresik">Gresik</option>
            </select>
            <input name="date" type="date" required defaultValue={searchParams.date ?? ""} aria-label="Tanggal acara" className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-ink" />
            <input name="time" type="time" required defaultValue={searchParams.time ?? ""} aria-label="Jam acara" className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-ink" />
            <input name="guests" type="number" min={1} required defaultValue={searchParams.guests ?? ""} placeholder="Tamu" aria-label="Jumlah tamu" className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-ink" />
            <span className="block rounded-full border border-stone-200 bg-white px-4 py-2.5 focus-within:border-ink">
              <RupiahInput name="budgetMax" variant="bare" defaultValue={searchParams.budgetMax ?? ""} placeholder="Budget maks" />
            </span>
            <button className={buttonLink("dark")}>Cari</button>
          </div>
          {located && (
            <>
              <input type="hidden" name="lat" value={searchParams.lat} />
              <input type="hidden" name="lng" value={searchParams.lng} />
            </>
          )}
          <p className="mt-2 px-2 text-xs text-stone-600">Tanggal & jam wajib diisi agar kapasitas vendor bisa dicek sebelum pesanan dikirim.</p>
        </form>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <p className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
            <span>
              <span className="font-display text-2xl text-ink">{results.length}</span> vendor ditemukan
            </span>
            <NearMeButton active={located} />
          </p>
          {showReco && (
            <Link href="/catering" className="text-sm font-semibold text-brand-700 hover:underline">
              Reset filter
            </Link>
          )}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((v, i) => (
            <div key={v.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <VendorCard
                href={`/catering/${v.id}${
                  searchParams.date || located
                    ? `?${new URLSearchParams({
                        ...(searchParams.date
                          ? ({ date: searchParams.date, time: searchParams.time ?? "", guests: searchParams.guests ?? "" } as Record<string, string>)
                          : {}),
                        ...(searchParams.city ? { city: searchParams.city } : {}),
                        ...pinParams,
                      }).toString()}`
                    : ""
                }`}
                showScore={showReco}
                v={{
                  id: v.id,
                  businessName: v.businessName,
                  city: v.city,
                  rating: v.rating,
                  reviewCount: v.reviewCount,
                  startingPrice: v.startingPrice,
                  remaining: v.remaining,
                  hasCapacity: v.hasCapacity,
                  score: v.score,
                  reasons: v.reasons,
                  description: v.description,
                  logoUrl: v.logoUrl,
                  coverUrl: v.coverUrl,
                  distanceKm: v.distanceKm,
                  deliveryFee: v.deliveryFee,
                  deliveryInRange: v.deliveryInRange,
                }}
              />
            </div>
          ))}
        </div>
        {results.length === 0 && (
          <div className="mt-6 rounded-4xl bg-blush p-12 text-center">
            <p className="font-display text-3xl text-ink">
              Belum ada yang <em className="em-berry">cocok</em>.
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
              Coba longgarkan budget, ganti tanggal, atau pilih kota lain di Surabaya Raya.
            </p>
            <Link href="/catering" className={buttonLink("primary", "mt-5")}>
              Lihat semua vendor
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
