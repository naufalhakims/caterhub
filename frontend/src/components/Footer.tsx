import Link from "next/link";
import { Logo } from "@/components/Logo";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Pelanggan",
    links: [
      ["/catering", "Jelajahi catering"],
      ["/events/new", "Buat acara"],
      ["/dashboard", "Pesanan saya"],
      ["/notifications", "Notifikasi"],
    ],
  },
  {
    title: "Vendor UMKM",
    links: [
      ["/register", "Daftarkan usaha"],
      ["/vendor/dashboard", "Dashboard vendor"],
      ["/vendor/capacity", "Atur kapasitas"],
      ["/vendor/verification", "Verifikasi usaha"],
    ],
  },
  {
    title: "Bantuan",
    links: [
      ["/#cara-kerja", "Cara kerja"],
      ["/login", "Masuk"],
      ["/register", "Buat akun"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 bg-cocoa text-stone-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo tone="sun" className="text-5xl" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-stone-400">
            Marketplace dan alat operasional untuk UMKM catering Surabaya Raya, dari permintaan pesanan sampai
            makanan tiba di meja.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="font-semibold text-white">{c.title}</p>
            <ul className="mt-4 space-y-3 text-sm">
              {c.links.map(([href, label]) => (
                <li key={label}>
                  <Link href={href} className="transition-colors hover:text-sun-300">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-6 text-sm text-stone-400">
          <p>
            ©<span className="font-display text-tangerine">caterhub</span> {new Date().getFullYear()}. Demo kompetisi.
          </p>
          <p>Harga dalam Rupiah · Zona waktu WIB</p>
        </div>
      </div>
    </footer>
  );
}
