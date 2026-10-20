"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-extrabold">Terjadi kesalahan</h1>
      <p className="mt-2 text-sm text-stone-500">Coba muat ulang halaman.</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-orange-700 px-5 py-2 text-sm font-semibold text-white"
      >
        Coba Lagi
      </button>
    </main>
  );
}
