import Link from "next/link";
import { formatIDR } from "@/lib/format";
import { FoodArt } from "@/components/FoodArt";

export type VendorCardData = {
  id: string;
  businessName: string;
  city: string;
  rating: number;
  reviewCount: number;
  startingPrice: number | null;
  remaining: number;
  hasCapacity: boolean;
  score?: number;
  reasons?: string[];
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
};

/** Kartu produk: gambar besar, nama, lalu bar harga kuning seperti referensi. */
export function VendorCard({ v, href, showScore }: { v: VendorCardData; href: string; showScore?: boolean }) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white pressable hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {v.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.coverUrl}
            alt={`Hidangan ${v.businessName}`}
            className="h-full w-full object-cover transition-transform duration-700 ease-fluid group-hover:scale-[1.03]"
          />
        ) : (
          <FoodArt seed={v.businessName} className="h-full w-full transition-transform duration-700 ease-fluid group-hover:scale-[1.03]" />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold ${
              v.hasCapacity ? "text-emerald-700" : "text-red-700"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${v.hasCapacity ? "bg-emerald-500" : "bg-red-500"}`} />
            {v.hasCapacity ? `Sisa ${v.remaining} pax` : "Penuh"}
          </span>
          {showScore && v.score != null && (
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white">Cocok {v.score}%</span>
          )}
        </div>
        {v.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.logoUrl}
            alt=""
            className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-white object-cover ring-2 ring-white"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <p className="text-lg font-semibold leading-snug text-ink">{v.businessName}</p>
        <p className="mt-1 text-sm text-stone-500">
          {v.city} · <span className="font-semibold text-ink">★ {v.rating.toFixed(1)}</span>
          <span className="text-stone-400"> ({v.reviewCount} ulasan)</span>
        </p>
        {showScore && v.reasons && v.reasons.length > 0 && (
          <p className="mt-2 line-clamp-1 text-[13px] text-brand-700">{v.reasons.slice(0, 2).join(" · ")}</p>
        )}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between rounded-lg bg-sun-400 px-4 py-2.5 text-[15px] text-ink transition-colors duration-200 group-hover:bg-sun-300">
            {v.startingPrice != null ? (
              <>
                <span>
                  <span className="font-display">Mulai</span> <span className="text-stone-700">/ pax</span>
                </span>
                <span className="flex items-center gap-1.5 font-display text-lg">
                  {formatIDR(v.startingPrice)}
                  <span aria-hidden className="font-sans text-sm transition-transform duration-300 ease-fluid group-hover:translate-x-0.5">→</span>
                </span>
              </>
            ) : (
              <span className="font-display">Lihat paket →</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
