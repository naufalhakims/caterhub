import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200/80 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold tracking-tight">
            Cater<span className="text-brand-700">Hub</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-stone-500">
            Marketplace dan platform operasional untuk UMKM catering di Surabaya Raya.
          </p>
        </div>
        <div>
          <p className="text-sm font-bold">Pelanggan</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-600">
            <li><Link href="/events/new" className="hover:text-brand-700">Buat acara</Link></li>
            <li><Link href="/catering" className="hover:text-brand-700">Jelajahi catering</Link></li>
            <li><Link href="/dashboard" className="hover:text-brand-700">Pesanan saya</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold">Vendor</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-600">
            <li><Link href="/register" className="hover:text-brand-700">Daftarkan usaha</Link></li>
            <li><Link href="/vendor/dashboard" className="hover:text-brand-700">Dashboard vendor</Link></li>
            <li><Link href="/login" className="hover:text-brand-700">Masuk</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-100">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-stone-400">
          CaterHub · Demo kompetisi · Harga dalam Rupiah (IDR), zona waktu Asia/Jakarta.
        </p>
      </div>
    </footer>
  );
}
