import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
        {/* Banner header */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-stone-900 text-white">
          {vendor.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vendor.coverUrl} alt={`Cover ${vendor.businessName}`} className="absolute inset-0 h-full w-full object-cover opacity-40" />
          )}
          <div className="hero-dots-light absolute inset-0 opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/40 to-transparent" />
          <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-8">
            <p className="text-sm text-white/70">
              <Link href="/catering" className="hover:text-white hover:underline">← Semua catering</Link>
            </p>
            <div className="mt-4 flex flex-wrap items-start gap-5">
              {vendor.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vendor.logoUrl} alt={`Logo ${vendor.businessName}`} className="h-20 w-20 shrink-0 rounded-3xl bg-white object-cover shadow-lift ring-1 ring-white/20" />
              ) : (
                <span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-white font-display text-4xl font-bold text-brand-800 shadow-lift">
                  {initial}
                </span>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-3xl font-bold tracking-tight">{vendor.businessName}</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                    ✓ Terverifikasi
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-white/75">
                  {vendor.city} · <span className="font-semibold text-amber-300">★ {vendor.rating.toFixed(1)}</span>
                  <span className="text-white/60"> ({vendor.reviewCount} ulasan)</span>
                  {vendor.address ? ` · ${vendor.address}` : ""}
                </p>
                {vendor.description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">{vendor.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">
                    {vendor.minPax}–{vendor.maxPax} pax
                  </span>
                  {cheapest != null && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">
                      Mulai {formatIDR(cheapest)}/pax
                    </span>
                  )}
                  {vendor.phone && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">{vendor.phone}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl gap-6 px-4 py-8 lg:grid lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            {searchParams.error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-soft">
                {searchParams.error}
              </div>
            )}
            {cap && (
              <div className={`${searchParams.error ? "mt-3" : ""} rounded-2xl border p-4 text-sm font-semibold shadow-soft ${cap.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                {cap.ok
                  ? `✓ Tersedia — sisa ${cap.remaining} pax pada ${searchParams.date}${searchParams.time ? ` pukul ${searchParams.time}` : ""}.`
                  : "✕ Kapasitas vendor tidak mencukupi untuk jumlah pax yang dipilih."}
              </div>
            )}

            {vendor.gallery.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {vendor.gallery.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt={`Galeri ${vendor.businessName}`} className="h-28 w-full rounded-xl object-cover ring-1 ring-stone-200" />
                ))}
              </div>
            )}

            <h2 className="mt-8 font-display text-xl font-bold">Paket catering</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {vendor.packages.map((p, i) => (
                <Card key={p.id} className={`relative transition hover:shadow-lift ${i === 0 ? "ring-2 ring-brand-200" : ""}`}>
                  {i === 0 && (
                    <span className="absolute -top-2.5 left-4 rounded-full bg-brand-700 px-2.5 py-0.5 text-[11px] font-bold text-white">
                      PALING LARIS
                    </span>
                  )}
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="mb-2.5 h-32 w-full rounded-xl object-cover ring-1 ring-stone-200" />
                  )}
                  <p className="font-bold">{p.name}</p>
                  <p className="mt-0.5">
                    <span className="text-lg font-extrabold text-brand-800">{formatIDR(p.pricePerPax)}</span>
                    <span className="text-sm text-stone-500">/pax · {p.minPax}–{p.maxPax} pax</span>
                  </p>
                  {p.description && <p className="mt-1.5 text-sm text-stone-600">{p.description}</p>}
                  <ul className="mt-2.5 space-y-1 text-sm text-stone-600">
                    {p.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">✓</span>
                        {it.name}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
              {vendor.packages.length === 0 && <p className="text-sm text-stone-500">Belum ada paket aktif.</p>}
            </div>

            <h2 className="mt-8 font-display text-xl font-bold">Menu</h2>
            <div className="mt-3 space-y-4">
              {Object.entries(menusByCat).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{cat}</p>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    {items.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200/80 bg-white px-3.5 py-2.5 text-sm shadow-soft">
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
                          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
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
                <h2 className="mt-8 font-display text-xl font-bold">Ulasan pelanggan</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {vendor.reviews.map((r) => (
                    <Card key={r.id} className="!p-4">
                      <p className="text-sm">
                        <span className="font-bold text-amber-600">★ {r.rating}</span>
                        <span className="text-stone-400"> · {r.customerName}</span>
                      </p>
                      {r.comment && <p className="mt-1 text-sm leading-relaxed text-stone-600">“{r.comment}”</p>}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sticky order panel */}
          <aside className="mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-20">
              <Card className="border-brand-100 !bg-gradient-to-b !from-brand-50 !to-white">
                <h2 className="font-display text-lg font-bold">Pesan Catering</h2>
                <p className="mt-0.5 text-[13px] text-stone-500">
                  Isi tanggal, jam, dan pesanan Anda. Tidak perlu membuat acara lebih dulu.
                </p>
                {!session?.user ? (
                  <div className="mt-3">
                    <Link href="/login"><Button className="w-full">Masuk untuk memesan</Button></Link>
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
                        <input name="eventDate" type="date" required defaultValue={searchParams.date ?? ""} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[13px] font-medium text-stone-600">Jam <span className="text-red-500">*</span></span>
                        <input name="eventTime" type="time" required defaultValue={searchParams.time ?? ""} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
                      </label>
                    </div>
                    <label className="block text-sm">
                      <span className="mb-1 block text-[13px] font-medium text-stone-600">Jumlah tamu (pax) <span className="text-red-500">*</span></span>
                      <input name="guestCount" type="number" min={10} max={vendor.maxPax} required defaultValue={searchParams.guests ?? ""} placeholder="cth. 250" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-brand-500" />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-[13px] font-medium text-stone-600">Lokasi acara <span className="text-red-500">*</span></span>
                      <input name="location" required minLength={3} maxLength={300} placeholder="cth. Gedung Sasono Utomo" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-brand-500" />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-[13px] font-medium text-stone-600">Kota</span>
                      <select name="city" defaultValue={searchParams.city ?? "Surabaya"} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                        <option>Surabaya</option>
                        <option>Sidoarjo</option>
                        <option>Gresik</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-[13px] font-medium text-stone-600">Paket yang diinginkan <span className="text-red-500">*</span></span>
                      <select name="packageId" required defaultValue={vendor.packages[0]?.id} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                        {vendor.packages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatIDR(p.pricePerPax)}/pax
                          </option>
                        ))}
                      </select>
                    </label>
                    <input name="notes" maxLength={1000} placeholder="Kustomisasi: tambah dessert, tanpa seafood…" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-brand-500" />
                    <SubmitButton requireDirty={false} className="w-full !py-2.5">Kirim permintaan pesanan</SubmitButton>
                  </form>
                )}
                <div className="mt-3 border-t border-brand-100 pt-3 text-xs leading-relaxed text-stone-500">
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
