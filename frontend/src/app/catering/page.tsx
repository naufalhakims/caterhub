import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { VendorCard } from "@/components/VendorCard";
import { searchVendors } from "@/server/marketplace";
import { RupiahInput } from "@/components/ui/RupiahInput";

export default async function CateringPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const results = await searchVendors(searchParams);
  const showReco = !!(searchParams.date || searchParams.guests || searchParams.budgetMax);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
          {showReco ? "Rekomendasi terpersonalisasi" : "Marketplace"}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          {showReco ? "Rekomendasi untuk acara Anda" : "Jelajahi Catering"}
        </h1>
        {showReco && (searchParams.date || searchParams.guests) && (
          <p className="mt-1 text-sm text-stone-500">
            {searchParams.guests ? `${searchParams.guests} tamu` : ""}
            {searchParams.guests && searchParams.date ? " · " : ""}
            {searchParams.date ? `tanggal ${searchParams.date}` : ""}
            {searchParams.budgetMax ? ` · budget maks Rp${Number(searchParams.budgetMax).toLocaleString("id-ID")}` : ""}
          </p>
        )}

        <form
          action="/catering"
          method="get"
          className="mt-5 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-soft"
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
            <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Cari nama catering…" aria-label="Cari catering" className="rounded-xl border border-stone-200 bg-[#FAF7F1] px-3 py-2 text-sm outline-none focus:border-brand-500" />
            <select name="city" defaultValue={searchParams.city ?? ""} aria-label="Kota" className="rounded-xl border border-stone-200 bg-[#FAF7F1] px-3 py-2 text-sm outline-none focus:border-brand-500">
              <option value="">Semua kota</option>
              <option value="Surabaya">Surabaya</option>
              <option value="Sidoarjo">Sidoarjo</option>
              <option value="Gresik">Gresik</option>
            </select>
            <input name="date" type="date" defaultValue={searchParams.date ?? ""} aria-label="Tanggal acara" className="rounded-xl border border-stone-200 bg-[#FAF7F1] px-3 py-2 text-sm outline-none focus:border-brand-500" />
            <input name="guests" type="number" min={1} defaultValue={searchParams.guests ?? ""} placeholder="Tamu" aria-label="Jumlah tamu" className="rounded-xl border border-stone-200 bg-[#FAF7F1] px-3 py-2 text-sm outline-none focus:border-brand-500" />
            <span className="block rounded-xl border border-stone-200 bg-[#FAF7F1] px-3 py-2 focus-within:border-brand-500">
              <RupiahInput name="budgetMax" variant="bare" defaultValue={searchParams.budgetMax ?? ""} placeholder="Budget maks" />
            </span>
            <button className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-800">
              Filter
            </button>
          </div>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-stone-500">
            <span className="font-bold text-stone-800">{results.length}</span> vendor ditemukan
          </p>
          {showReco && (
            <Link href="/catering" className="text-sm font-semibold text-brand-700 hover:underline">
              Reset filter
            </Link>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((v, i) => (
            <div key={v.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <VendorCard
                href={`/catering/${v.id}${searchParams.date ? `?date=${searchParams.date}&guests=${searchParams.guests ?? ""}` : ""}`}
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
                }}
              />
            </div>
          ))}
        </div>
        {results.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <p className="font-display text-xl font-bold">Tidak ada vendor yang cocok.</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
              Coba longgarkan budget, ganti tanggal, atau pilih kota lain di Surabaya Raya.
            </p>
            <Link href="/catering" className="mt-4 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white">
              Lihat semua vendor
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
