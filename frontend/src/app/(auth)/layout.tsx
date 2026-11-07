import Link from "next/link";
import { Logo } from "@/components/Logo";

const POINTS = [
  ["Nota transparan", "Ongkir & biaya tambahan masuk ke nota sebelum Anda membayar."],
  ["Kapasitas terjamin", "Pesanan dikonfirmasi hanya bila dapur vendor masih muat."],
  ["Bayar lunas via QRIS", "Satu pembayaran, status pesanan terbarui otomatis."],
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-white p-3 lg:grid-cols-[1.05fr_1fr] lg:gap-3">
      <div className="relative hidden overflow-hidden rounded-4xl bg-gradient-to-br from-mint via-[#EEF4B4] to-sun-400 lg:block">
        <span aria-hidden className="absolute -bottom-10 right-6 text-[13rem] opacity-90 drop-shadow-xl">🍱</span>
        <span aria-hidden className="absolute bottom-40 right-56 rotate-12 text-8xl drop-shadow-lg">🍗</span>
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="w-fit">
            <Logo className="text-4xl" />
          </Link>
          <div className="max-w-md pb-24">
            <p className="font-display text-6xl leading-[1.02] text-ink">
              Satu platform untuk <em>acara</em> dan <em className="em-tangerine">dapur</em> Anda.
            </p>
            <ul className="mt-10 space-y-4 text-[15px] text-stone-800">
              {POINTS.map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand-700">
                    ✓
                  </span>
                  <p>
                    <span className="font-semibold text-ink">{t}</span> — {d}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-stone-700">Vendor UMKM Surabaya, Sidoarjo, dan Gresik.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo className="text-3xl" />
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}
