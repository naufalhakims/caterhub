"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { DEFAULT_CENTER } from "@/lib/delivery";

type Props = {
  /** Nama input tersembunyi yang dikirim bersama form. */
  latName?: string;
  lngName?: string;
  initial?: { latitude: number; longitude: number } | null;
  /** Titik referensi (mis. dapur vendor) — ditampilkan sebagai penanda kedua. */
  reference?: { latitude: number; longitude: number; label: string } | null;
  /** Isi input alamat ini dengan hasil pencarian bila masih kosong. */
  addressInputName?: string;
  height?: number;
  label?: string;
};

type SearchResult = { lat: string; lon: string; display_name: string };

const pin = (color: string, label: string) =>
  `<div style="display:grid;place-items:center;width:30px;height:30px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.25)"><span style="transform:rotate(45deg);font-size:13px;line-height:1">${label}</span></div>`;

/**
 * Pemilih lokasi: peta OpenStreetMap (Leaflet) dengan pin yang bisa digeser,
 * tombol "Gunakan lokasi saya" (GPS), dan pencarian alamat (Nominatim).
 * Menulis koordinat ke input tersembunyi lalu memicu event `change` pada form
 * sehingga estimasi ongkir ikut diperbarui.
 */
export function LocationPicker({
  latName = "latitude",
  lngName = "longitude",
  initial,
  reference,
  addressInputName,
  height = 260,
  label = "Titik lokasi",
}: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [point, setPoint] = useState(initial ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  // Tulis ke input tersembunyi + beri tahu form (event sintetis tidak dipicu oleh React).
  const commit = (lat: number, lng: number) => {
    const latitude = Math.round(lat * 1e6) / 1e6;
    const longitude = Math.round(lng * 1e6) / 1e6;
    setPoint({ latitude, longitude });
    if (latRef.current && lngRef.current) {
      latRef.current.value = String(latitude);
      lngRef.current.value = String(longitude);
      latRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  const placeMarker = (lat: number, lng: number, pan = true) => {
    const L = (window as unknown as { L?: typeof import("leaflet") }).L;
    const map = mapRef.current;
    if (!map || !L) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({ html: pin("#1d1b16", "📍"), className: "", iconSize: [30, 30], iconAnchor: [15, 30] }),
        keyboard: true,
        title: label,
      }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        commit(p.lat, p.lng);
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 15));
    commit(lat, lng);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapEl.current || mapRef.current) return;
      (window as unknown as { L: typeof L }).L = L;
      const start = initial ?? reference ?? DEFAULT_CENTER;
      const map = L.map(mapEl.current, { scrollWheelZoom: false }).setView([start.latitude, start.longitude], initial ? 15 : 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      if (reference) {
        L.marker([reference.latitude, reference.longitude], {
          icon: L.divIcon({ html: pin("#ee5a1f", "🍳"), className: "", iconSize: [30, 30], iconAnchor: [15, 30] }),
          title: reference.label,
          interactive: false,
        }).addTo(map);
      }
      map.on("click", (e) => placeMarker(e.latlng.lat, e.latlng.lng, false));
      mapRef.current = map;
      if (initial) placeMarker(initial.latitude, initial.longitude, false);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Peta dibuat sekali; titik awal hanya dibaca saat mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setStatus("Browser tidak mendukung GPS. Geser pin di peta.");
      return;
    }
    setStatus("Mencari lokasi Anda…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setStatus(null);
        placeMarker(p.coords.latitude, p.coords.longitude);
      },
      () => setStatus("Izin lokasi ditolak. Cari alamat atau ketuk peta."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const search = async () => {
    const q = query.trim();
    if (q.length < 3) return;
    setStatus("Mencari alamat…");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=id&accept-language=id&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = (await res.json()) as SearchResult[];
      setResults(data);
      setStatus(data.length ? null : "Alamat tidak ditemukan. Coba nama jalan/gedung lain, atau ketuk peta.");
    } catch {
      setStatus("Pencarian alamat sedang tidak tersedia. Ketuk peta untuk menaruh pin.");
    }
  };

  const choose = (r: SearchResult) => {
    setResults([]);
    setQuery("");
    placeMarker(Number(r.lat), Number(r.lon));
    if (addressInputName) {
      const form = mapEl.current?.closest("form");
      const input = form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${addressInputName}"]`);
      if (input && !input.value.trim()) {
        input.value = r.display_name.split(",").slice(0, 3).join(",").trim();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  };

  return (
    <div className="space-y-2">
      <input ref={latRef} type="hidden" name={latName} defaultValue={initial?.latitude ?? ""} />
      <input ref={lngRef} type="hidden" name={lngName} defaultValue={initial?.longitude ?? ""} />

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-1 basis-full sm:basis-0">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            placeholder="Cari alamat / gedung…"
            aria-label="Cari alamat"
            className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200"
          />
          {results.length > 0 && (
            <ul role="listbox" className="absolute inset-x-0 top-full z-[1000] mt-1 max-h-56 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1 shadow-lift">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs text-stone-700 hover:bg-paper"
                  >
                    {r.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => void search()}
          className="rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ring-inset ring-stone-300 transition-colors hover:ring-ink"
        >
          Cari
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          className="rounded-full bg-ink px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
        >
          📍 Lokasi saya
        </button>
      </div>

      <div
        ref={mapEl}
        style={{ height }}
        className="isolate overflow-hidden rounded-2xl ring-1 ring-stone-200"
        aria-label={`${label}: ketuk peta atau geser pin`}
      />
      <p className="text-xs text-stone-500" aria-live="polite">
        {status ??
          (point
            ? `Pin: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}. Geser pin untuk menyesuaikan.`
            : "Ketuk peta, cari alamat, atau pakai lokasi Anda untuk menaruh pin.")}
      </p>
    </div>
  );
}
