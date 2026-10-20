import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-stone-900 text-white lg:block">
        <div className="hero-dots-light absolute inset-0 opacity-50" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white font-display text-lg font-bold text-brand-800">
              C
            </span>
            <span className="text-lg font-extrabold tracking-tight">CaterHub</span>
          </Link>
          <div>
            <p className="font-display text-4xl font-bold leading-tight">
              Satu platform untuk acara dan usaha catering Anda.
            </p>
            <div className="mt-8 space-y-4 text-sm text-white/80">
              {[
                ["Penawaran transparan", "Rincian harga item per item, tanpa biaya siluman."],
                ["Kapasitas terjamin", "Pesanan dikunci hanya bila dapur masih muat."],
                ["Bayar via QRIS", "DP 50% atau lunas, status terupdate otomatis."],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-xs text-emerald-300">✓</span>
                  <p><span className="font-semibold text-white">{t}</span> — {d}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/50">Dipercaya vendor Surabaya, Sidoarjo, dan Gresik.</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-[#FAF7F1] px-4 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 inline-block text-sm text-stone-500 hover:text-brand-700 lg:hidden">
            ← Beranda
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}
