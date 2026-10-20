import Link from "next/link";
import { formatIDR } from "@/lib/format";

const BANNERS = [
  "from-brand-800 via-brand-700 to-brand-500",
  "from-stone-800 via-stone-700 to-brand-700",
  "from-amber-800 via-brand-700 to-amber-600",
  "from-brand-900 via-stone-800 to-brand-600",
  "from-stone-900 via-brand-800 to-brand-600",
] as const;

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

function bannerIndex(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % BANNERS.length;
}

export function VendorCard({ v, href, showScore }: { v: VendorCardData; href: string; showScore?: boolean }) {
  const initial = v.businessName.trim().charAt(0).toUpperCase() || "C";
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className={`relative h-28 bg-gradient-to-br ${BANNERS[bannerIndex(v.businessName)]}`}>
        {v.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.coverUrl} alt={`Cover ${v.businessName}`} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="hero-dots-light absolute inset-0" aria-hidden />
        )}
        {v.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.logoUrl}
            alt={`Logo ${v.businessName}`}
            className="absolute -bottom-6 left-5 h-14 w-14 rounded-2xl bg-white object-cover shadow-soft ring-1 ring-stone-200"
          />
        ) : (
          <span className="absolute -bottom-6 left-5 grid h-14 w-14 place-items-center rounded-2xl bg-white font-display text-2xl font-bold text-brand-800 shadow-soft ring-1 ring-stone-200">
            {initial}
          </span>
        )}
        {showScore && v.score != null && (
          <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-800 shadow-sm">
            Skor {v.score}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-8">
        <p className="font-bold leading-tight group-hover:text-brand-800">{v.businessName}</p>
        <p className="mt-0.5 text-sm text-stone-500">
          {v.city} · <span className="font-semibold text-amber-600">★ {v.rating.toFixed(1)}</span>
          <span className="text-stone-400"> ({v.reviewCount})</span>
        </p>
        {v.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-stone-500">{v.description}</p>}
        <div className="mt-auto pt-3">
          {v.startingPrice != null ? (
            <p className="text-sm">
              <span className="text-stone-400">Mulai</span>{" "}
              <span className="font-extrabold">{formatIDR(v.startingPrice)}</span>
              <span className="text-stone-500">/pax</span>
            </p>
          ) : (
            <p className="text-sm text-stone-400">Harga hubungi vendor</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                v.hasCapacity
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-red-50 text-red-700 ring-red-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${v.hasCapacity ? "bg-emerald-500" : "bg-red-500"}`} />
              {v.hasCapacity ? `Sisa ${v.remaining} pax` : "Penuh tanggal ini"}
            </span>
            {v.reasons?.slice(0, 2).map((r) => (
              <span key={r} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
