import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-extrabold">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-stone-500">Tautan yang Anda buka tidak tersedia.</p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-orange-700 px-5 py-2 text-sm font-semibold text-white">
        Kembali ke Beranda
      </Link>
    </main>
  );
}
