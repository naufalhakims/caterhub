import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import { buttonLink } from "@/components/ui/Button";
import { FoodArt, backdropFor } from "@/components/FoodArt";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatIDR } from "@/lib/format";
import { apiGet, ApiError } from "@/lib/api";
import type { VendorDetailDto } from "@/lib/vendor-types";
import { auth } from "@/auth";

type CapacityPreview = { ok: boolean; remaining: number; maxPax: number; reservedPax: number };

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: { vendorId: string };
  searchParams: {
    date?: string;
    time?: string;
    guests?: string;
    city?: string;
    error?: string;
  };
}) {
  let vendor: VendorDetailDto;
  try {
    vendor = await apiGet<VendorDetailDto>(`/api/v1/vendors/${params.vendorId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const session = await auth();
  const canOrder = session?.user?.role === "CUSTOMER";

  const guests = searchParams.guests ? parseInt(searchParams.guests) : NaN;
  let cap: CapacityPreview | null = null;
  if (searchParams.date && !isNaN(guests)) {
    const qs = new URLSearchParams({
      vendorId: vendor.id,
      date: searchParams.date,
      guests: String(guests),
    });
    cap = await apiGet<CapacityPreview>(`/api/v1/capacity?${qs.toString()}`);
  }

  const menusByCat: Record<string, typeof vendor.menuItems> = {};
  for (const m of vendor.menuItems) {
    if (!menusByCat[m.category]) menusByCat[m.category] = [];
    menusByCat[m.category].push(m);
  }
  const cheapest = vendor.packages.length
    ? Math.min(...vendor.packages.map((p) => p.pricePerPax))
    : null;

  const initial = vendor.businessName.trim().charAt(0).toUpperCase() || "C";

  return (
    <>
      <Navbar />
      <main className="pb-4">
        {/* Header — panel gradien buah */}
        <section className="px-3 pt-3 sm:px-4">
          <div className={`relative mx-auto grid max-w-[88rem] items-center gap-8 overflow-hidden rounded-4xl bg-gradient-to-br ${backdropFor(vendor.businessName)} px-6 py-10 sm:px-12 lg:grid-cols-[1.4fr_1fr]`}>
            <div className="min-w-0">
              <p className="text-sm text-stone-600">
                <Link href="/catering" className="hover:text-ink hover:underline">← Semua catering</Link>
              </p>
              <div className="mt-5 flex items-center gap-4">
                {vendor.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vendor.logoUrl} alt={`Logo ${vendor.businessName}`} className="h-16 w-16 shrink-0 rounded-full bg-white object-cover ring-4 ring-white/70" />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white font-display text-3xl text-ink ring-4 ring-white/60">
                    {initial}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-800">
                  ✓ Terverifikasi
                </span>
              </div>
              <h1 className="mt-5 font-display text-5xl text-ink sm:text-6xl">{vendor.businessName}</h1>
              <p className="mt-3 text-[15px] text-stone-700">
                {vendor.city} · <span className="font-semibold text-ink">★ {vendor.rating.toFixed(1)}</span>
                <span className="text-stone-500"> ({vendor.reviewCount} ulasan)</span>
                {vendor.address ? ` · ${vendor.address}` : ""}
              </p>
              {vendor.description && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-stone-700">{vendor.description}</p>}
              <div className="mt-5 flex flex-wrap gap-2 text-sm font-medium">
                <span className="rounded-full bg-white/80 px-3.5 py-1.5">{vendor.minPax}–{vendor.maxPax} pax</span>
                {vendor.phone && <span className="rounded-full bg-white/80 px-3.5 py-1.5">{vendor.phone}</span>}
              </div>
            </div>
            <div className="flex flex-col items-start gap-6 lg:items-end">
              {vendor.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vendor.coverUrl} alt={`Hidangan ${vendor.businessName}`} className="hidden h-56 w-full rounded-3xl object-cover ring-4 ring-white/60 lg:block" />
              ) : (
                <FoodArt seed={vendor.businessName} size="lg" className="hidden h-56 w-full rounded-3xl !bg-none lg:grid" />
              )}
              {cheapest != null && (
                <div className="lg:text-right">
                  <p className="font-display text-5xl text-ink sm:text-6xl">{formatIDR(cheapest)}</p>
                  <p className="text-sm font-medium text-stone-700">Harga mulai per pax</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid lg:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            {searchParams.error && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {searchParams.error}
              </div>
            )}
            {cap && (
              <div className={`${searchParams.error ? "mt-3" : ""} rounded-2xl border p-4 text-sm font-semibold ${cap.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                {cap.ok
                  ? `✓ Tersedia — sisa ${cap.remaining} pax pada ${searchParams.date}${searchParams.time ? ` pukul ${searchParams.time}` : ""}.`
                  : "✕ Kapasitas vendor tidak mencukupi untuk jumlah pax yang dipilih."}
              </div>
            )}

            {vendor.gallery.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {vendor.gallery.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt={`Galeri ${vendor.businessName}`} className="aspect-square w-full rounded-2xl object-cover" />
                ))}
              </div>
            )}

            <h2 className="mt-10 font-display text-4xl text-ink">
              Pilih <em>paket</em> <span className="text-stone-400">–</span>
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {vendor.packages.map((p, i) => (
                <Card key={p.id} className="relative flex flex-col overflow-hidden !p-0">
                  <div className="relative aspect-[16/10]">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <FoodArt seed={`${vendor.businessName}-${p.name}`} className="h-full w-full" />
                    )}
                    {i === 0 && (
                      <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                        Paling laris
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                  <p className="text-lg font-semibold text-ink">{p.name}</p>
                  <p className="text-sm text-stone-500">{p.minPax}–{p.maxPax} pax</p>
                  {p.description && <p className="mt-2 text-sm text-stone-600">{p.description}</p>}
                  <ul className="mt-2.5 space-y-1 text-sm text-stone-600">
                    {p.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">✓</span>
                        {it.name}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-4">
                    <div className="flex items-center justify-between rounded-lg bg-sun-400 px-4 py-2.5 text-ink">
                      <span className="font-display">Per pax</span>
                      <span className="font-display text-lg">{formatIDR(p.pricePerPax)}</span>
                    </div>
                  </div>
                  </div>
                </Card>
              ))}
              {vendor.packages.length === 0 && <p className="text-sm text-stone-500">Belum ada paket aktif.</p>}
            </div>

            <h2 className="mt-14 font-display text-4xl text-ink">
              <em className="em-tangerine">Menu</em> dapur
            </h2>
            <div className="mt-3 space-y-4">
              {Object.entries(menusByCat).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{cat}</p>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    {items.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          {m.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.imageUrl} alt={m.name} className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-stone-200" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold">{m.name}</p>
                            {m.description && <p className="line-clamp-1 text-xs text-stone-400">{m.description}</p>}
                          </div>
                        </div>
                        {m.price > 0 && (
                          <span className="shrink-0 rounded-full bg-sun-200 px-2.5 py-0.5 text-xs font-semibold text-ink">
                            +{formatIDR(m.price)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {vendor.reviews.length > 0 && (
              <>
                <div className="mt-14 rounded-4xl bg-blush p-6 sm:p-8">
                  <h2 className="font-display text-4xl text-ink">
                    Kata <em className="em-berry">pelanggan</em>
                  </h2>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {vendor.reviews.map((r) => (
                      <figure key={r.id} className="rounded-3xl bg-white p-5">
                        {r.comment && <blockquote className="text-[15px] leading-relaxed text-stone-700">“{r.comment}”</blockquote>}
                        <figcaption className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4 text-sm">
                          <span className="font-semibold text-ink">{r.customerName ?? "Pelanggan"}</span>
                          <span className="rounded-lg bg-paper px-2 py-0.5 font-semibold">
                            {r.rating.toFixed(1)} <span className="text-amber-500">★</span>
                          </span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sticky order panel */}
          <aside className="mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <Card className="!rounded-4xl !p-6 shadow-lift">
                <h2 className="font-display text-3xl text-ink">
                  Pesan <em>sekarang</em>
                </h2>
                <p className="mt-0.5 text-[13px] text-stone-500">
                  Isi tanggal, jam, dan pesanan Anda. Tidak perlu membuat acara lebih dulu.
                </p>
                {!session?.user ? (
                  <div className="mt-3">
                    <Link href="/login" className={buttonLink("primary", "w-full")}>Masuk untuk memesan</Link>
                    <p className="mt-2 text-center text-xs text-stone-400">
                      Belum punya akun? <Link href="/register" className="font-semibold text-brand-700">Daftar</Link>
                    </p>
                  </div>
                ) : !canOrder ? (
                  <p className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600">
                    Pemesanan hanya tersedia untuk akun pelanggan.
                  </p>
                ) : vendor.packages.length === 0 ? (
                  <p className="mt-3 text-sm text-stone-500">Vendor belum membuka paket.</p>
                ) : (
                  <form action="/api/quotations/request" method="post" className="mt-3 space-y-3">
                    <input type="hidden" name="vendorId" value={vendor.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-sm">
                        <span className="mb-1 block text-[13px] font-medium text-stone-600">Tanggal <span className="text-red-500">*</span></span>
                        <input name="eventDate" type="date" required defaultValue={searchParams.date ?? ""} className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200" />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[13px] font-medium text-stone-600">Jam <span className="text-red-500">*</span></span>
                        <input name="eventTime" type="time" required defaultValue={searchParams.time ?? ""} className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200" />
                      </label>
                    </div>
                    <label className="block text-sm">
                      <span className="mb-1 block text-[13px] font-medium text-stone-600">Jumlah tamu (pax) <span className="text-red-500">*</span></span>
                      <input name="guestCount" type="number" min={10} max={vendor.maxPax} required defaultValue={searchParams.guests ?? ""} placeholder="cth. 250" className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200 placeholder:text-stone-400" />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-[13px] font-medium text-stone-600">Lokasi acara <span className="text-red-500">*</span></span>
                      <input name="location" required minLength={3} maxLength={300} placeholder="cth. Gedung Sasono Utomo" className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200 placeholder:text-stone-400" />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-[13px] font-medium text-stone-600">Kota</span>
                      <select name="city" defaultValue={searchParams.city ?? "Surabaya"} className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200">
                        <option>Surabaya</option>
                        <option>Sidoarjo</option>
                        <option>Gresik</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-[13px] font-medium text-stone-600">Paket yang diinginkan <span className="text-red-500">*</span></span>
                      <select name="packageId" required defaultValue={vendor.packages[0]?.id} className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200">
                        {vendor.packages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatIDR(p.pricePerPax)}/pax
                          </option>
                        ))}
                      </select>
                    </label>
                    <input name="notes" maxLength={1000} placeholder="Kustomisasi: tambah dessert, tanpa seafood…" className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200 placeholder:text-stone-400" />
                    <SubmitButton requireDirty={false} arrow className="w-full !py-3">Kirim permintaan pesanan</SubmitButton>
                  </form>
                )}
                <div className="mt-4 border-t border-stone-100 pt-4 text-xs leading-relaxed text-stone-500">
                  <StatusBadge status="VERIFIED" /> Vendor mengonfirmasi dulu. Ongkir & biaya lain ditambahkan otomatis ke nota saat pembayaran lunas.
                </div>
              </Card>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
