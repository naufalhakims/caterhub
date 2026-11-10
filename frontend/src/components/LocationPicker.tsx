"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { DEFAULT_CENTER } from "@/lib/delivery";

type Props = {
  /** Nama input tersembunyi koordinat yang dikirim bersama form. */
  latName?: string;
  lngName?: string;
  initial?: { latitude: number; longitude: number } | null;
  /** Titik referensi (mis. dapur vendor), ditampilkan sebagai penanda kedua. */
  reference?: { latitude: number; longitude: number; label: string } | null;
  /**
   * Bila diisi, kolom di atas peta adalah kolom ALAMAT form dengan nama ini (wajib),
   * sekaligus pencarian: alamat dan titik selalu diisi bersama. Tanpa ini, kolom
   * tersebut hanya kotak pencarian (mis. lokasi dapur di profil vendor).
   */
  addressName?: string;
  initialAddress?: string;
  addressPlaceholder?: string;
  /** Pilih opsi kota di <select> ini bila alamat titik menyebut kota tersebut. */
  cityInputName?: string;
  height?: number;
  label?: string;
};

type SearchResult = { lat: string; lon: string; display_name: string };

const NOMINATIM = "https://nominatim.openstreetmap.org";

const pin = (color: string, label: string) =>
  `<div style="display:grid;place-items:center;width:30px;height:30px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.25)"><span style="transform:rotate(45deg);font-size:13px;line-height:1">${label}</span></div>`;

/** "Jalan X 5, RW 01, Keputran, Surabaya, …" → tiga bagian pertama. */
const shortAddress = (displayName: string) =>
  displayName.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3).join(", ");

/**
 * Pemilih lokasi: satu kolom alamat + peta OpenStreetMap (Leaflet).
 * - Ketik alamat → Enter/"Cari" → pilih hasil: alamat & pin terisi bersama.
 * - Ketik alamat lalu pindah kolom: pin otomatis ditaruh di hasil teratas.
 * - "Lokasi saya", ketuk, atau geser pin: alamat diisi dari titik (reverse geocode),
 *   kecuali pengguna sudah mengetik nama tempat sendiri.
 * Koordinat ditulis ke input tersembunyi lalu memicu event `change` pada form
 * sehingga estimasi ongkir dan tombol kirim ikut diperbarui.
 */
export function LocationPicker({
  latName = "latitude",
  lngName = "longitude",
  initial,
  reference,
  addressName,
  initialAddress = "",
  addressPlaceholder = "Ketik alamat / nama gedung…",
  cityInputName,
  height = 260,
  label = "Titik lokasi",
}: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [point, setPoint] = useState(initial ?? null);
  const [text, setText] = useState(addressName ? initialAddress : "");
  const textValueRef = useRef(addressName ? initialAddress : "");
  /** Teks terakhir yang diisi otomatis; boleh ditimpa lagi oleh titik berikutnya. */
  const autoTextRef = useRef<string | null>(null);
  /** Teks yang sudah pernah dicarikan pinnya (hindari geocode ulang saat blur). */
  const geocodedTextRef = useRef<string | null>(addressName && initial ? initialAddress : null);
  const reverseSeqRef = useRef(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const isAddressField = !!addressName;

  const setTextValue = (value: string, auto: boolean) => {
    textValueRef.current = value;
    autoTextRef.current = auto ? value : null;
    setText(value);
  };

  // Nilai kolom alamat diubah dari kode → beri tahu form (validasi tombol kirim).
  useEffect(() => {
    if (isAddressField) textRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [text, isAddressField]);

  // Koordinat adalah input terkontrol (nilai dari state `point`). Mengisi input hidden
  // lewat DOM tidak aman: render ulang React menimpa defaultValue-nya kembali kosong.
  const commit = (lat: number, lng: number) => {
    const latitude = Math.round(lat * 1e6) / 1e6;
    const longitude = Math.round(lng * 1e6) / 1e6;
    setPoint({ latitude, longitude });
  };

  // Setelah nilai koordinat dirender, beri tahu form (estimasi ongkir & tombol kirim).
  useEffect(() => {
    if (point) latRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [point]);

  const selectCity = (displayName: string) => {
    if (!cityInputName) return;
    const select = mapEl.current?.closest("form")?.querySelector<HTMLSelectElement>(`[name="${cityInputName}"]`);
    const match = select && Array.from(select.options).find((o) => o.value && displayName.includes(o.value));
    if (select && match && select.value !== match.value) {
      select.value = match.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  /** Alamat dari titik: isi kolom bila kosong / masih hasil otomatis. */
  const fillFromPoint = (displayName: string) => {
    selectCity(displayName);
    if (!isAddressField) return;
    const current = textValueRef.current.trim();
    if (!current || current === autoTextRef.current) {
      const short = shortAddress(displayName);
      setTextValue(short, true);
      geocodedTextRef.current = short;
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!isAddressField && !cityInputName) return;
    const seq = ++reverseSeqRef.current;
    try {
      const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&accept-language=id&lat=${lat}&lon=${lng}`, {
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as { display_name?: string };
      if (seq !== reverseSeqRef.current) return;
      if (data.display_name) fillFromPoint(data.display_name);
      else if (isAddressField && !textValueRef.current.trim()) setStatus("Alamat titik ini tidak ditemukan. Ketik nama lokasinya.");
    } catch {
      if (seq === reverseSeqRef.current && isAddressField && !textValueRef.current.trim()) {
        setStatus("Alamat tidak dapat dicari otomatis. Ketik nama lokasinya.");
      }
    }
  };

  const placeMarker = (lat: number, lng: number, opts: { pan?: boolean; lookup?: boolean } = {}) => {
    const { pan = true, lookup = true } = opts;
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
        setStatus(null);
        void reverseGeocode(p.lat, p.lng);
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 15));
    commit(lat, lng);
    if (lookup) void reverseGeocode(lat, lng);
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
      map.on("click", (e) => {
        setStatus(null);
        placeMarker(e.latlng.lat, e.latlng.lng, { pan: false });
      });
      mapRef.current = map;
      // Titik awal (mis. dari acara tersimpan) tidak menimpa alamat yang sudah ada.
      if (initial) placeMarker(initial.latitude, initial.longitude, { pan: false, lookup: false });
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
      setStatus("Browser tidak mendukung GPS. Ketik alamat atau ketuk peta.");
      return;
    }
    setStatus("Mencari lokasi Anda…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setStatus(null);
        placeMarker(p.coords.latitude, p.coords.longitude);
      },
      () => setStatus("Izin lokasi ditolak. Ketik alamat atau ketuk peta."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const geocode = async (q: string): Promise<SearchResult[]> => {
    const res = await fetch(`${NOMINATIM}/search?format=json&limit=5&countrycodes=id&accept-language=id&q=${encodeURIComponent(q)}`, {
      headers: { Accept: "application/json" },
    });
    return (await res.json()) as SearchResult[];
  };

  const search = async () => {
    const q = textValueRef.current.trim();
    if (q.length < 3) {
      setStatus("Ketik minimal 3 huruf alamat atau nama gedung.");
      return;
    }
    setStatus("Mencari alamat…");
    try {
      const data = await geocode(q);
      setResults(data);
      setStatus(data.length ? "Pilih alamat yang sesuai untuk menaruh titik di peta." : "Alamat tidak ditemukan. Coba nama jalan/gedung lain, atau ketuk peta.");
    } catch {
      setStatus("Pencarian alamat sedang tidak tersedia. Ketuk peta untuk menaruh titik.");
    }
  };

  const choose = (r: SearchResult) => {
    setResults([]);
    setStatus(null);
    reverseSeqRef.current++; // abaikan reverse geocode yang masih berjalan
    placeMarker(Number(r.lat), Number(r.lon), { lookup: false });
    selectCity(r.display_name);
    if (isAddressField) {
      // Nama tempat yang diketik sendiri dipertahankan; kolom kosong/otomatis diisi hasil.
      const typed = textValueRef.current.trim();
      const value = typed && typed !== autoTextRef.current ? typed : shortAddress(r.display_name);
      setTextValue(value, value !== typed);
      geocodedTextRef.current = value;
    } else {
      setTextValue("", false);
    }
  };

  /** Alamat diketik tanpa memilih hasil → taruh titik di hasil teratas agar titik tidak kosong. */
  const autoPinFromText = async () => {
    if (!isAddressField) return;
    const q = textValueRef.current.trim();
    if (q.length < 3 || q === geocodedTextRef.current || q === autoTextRef.current) return;
    geocodedTextRef.current = q;
    setStatus("Menaruh titik dari alamat…");
    try {
      const [top] = await geocode(q);
      if (textValueRef.current.trim() !== q) return; // pengguna sudah mengetik lagi
      if (top) {
        reverseSeqRef.current++;
        placeMarker(Number(top.lat), Number(top.lon), { lookup: false });
        selectCity(top.display_name);
        setStatus(`Titik ditaruh di "${shortAddress(top.display_name)}". Geser pin bila kurang tepat.`);
      } else {
        setStatus("Titik untuk alamat ini tidak ditemukan. Ketuk peta atau pakai lokasi Anda.");
      }
    } catch {
      setStatus("Pencarian alamat sedang tidak tersedia. Ketuk peta untuk menaruh titik.");
    }
  };

  return (
    <div className="space-y-2">
      <input ref={latRef} type="hidden" name={latName} value={point?.latitude ?? ""} readOnly />
      <input type="hidden" name={lngName} value={point?.longitude ?? ""} readOnly />

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-1 basis-full sm:basis-0">
          <input
            ref={textRef}
            name={addressName}
            required={isAddressField}
            minLength={isAddressField ? 3 : undefined}
            maxLength={300}
            value={text}
            onChange={(e) => {
              textValueRef.current = e.target.value;
              if (e.target.value !== autoTextRef.current) autoTextRef.current = null;
              setText(e.target.value);
            }}
            onBlur={() => void autoPinFromText()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            placeholder={isAddressField ? addressPlaceholder : "Cari alamat / gedung…"}
            aria-label={isAddressField ? label : "Cari alamat"}
            autoComplete="off"
            className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-ink focus:ring-4 focus:ring-sun-200"
          />
          {results.length > 0 && (
            <ul role="listbox" className="absolute inset-x-0 top-full z-[1000] mt-1 max-h-56 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1 shadow-lift">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    type="button"
                    // Cegah blur kolom (yang memicu titik otomatis) sebelum hasil dipilih.
                    onMouseDown={(e) => e.preventDefault()}
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
            ? `Titik: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}. Geser pin untuk menyesuaikan.`
            : isAddressField
              ? "Ketik alamat lalu tekan Cari, pakai lokasi Anda, atau ketuk peta. Alamat dan titik terisi bersamaan."
              : "Ketuk peta, cari alamat, atau pakai lokasi Anda untuk menaruh pin.")}
      </p>
    </div>
  );
}
