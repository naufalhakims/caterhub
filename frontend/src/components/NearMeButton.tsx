"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * "Dekat lokasi saya": ambil GPS lalu tambahkan lat/lng ke pencarian, sehingga
 * kartu vendor menampilkan jarak & ongkir dan rekomendasi memakai jarak nyata.
 */
export function NearMeButton({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [status, setStatus] = useState<string | null>(null);

  const go = (next: URLSearchParams) => router.push(`${pathname}?${next.toString()}`, { scroll: false });

  const locate = () => {
    if (!navigator.geolocation) return setStatus("Browser tidak mendukung GPS.");
    setStatus("Mencari lokasi…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setStatus(null);
        const next = new URLSearchParams(params.toString());
        next.set("lat", p.coords.latitude.toFixed(6));
        next.set("lng", p.coords.longitude.toFixed(6));
        go(next);
      },
      () => setStatus("Izin lokasi ditolak."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const clear = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("lat");
    next.delete("lng");
    go(next);
  };

  return (
    <span className="inline-flex items-center gap-2">
      {active ? (
        <button
          type="button"
          onClick={clear}
          className="rounded-full bg-sun-400 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sun-300"
        >
          📍 Jarak dari lokasi Anda ✕
        </button>
      ) : (
        <button
          type="button"
          onClick={locate}
          className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-stone-300 transition-colors hover:ring-ink"
        >
          📍 Dekat lokasi saya
        </button>
      )}
      {status && <span className="text-xs text-stone-500" aria-live="polite">{status}</span>}
    </span>
  );
}
