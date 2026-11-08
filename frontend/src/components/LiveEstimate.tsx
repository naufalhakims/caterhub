"use client";

import { useEffect, useRef, useState } from "react";
import { formatIDR } from "@/lib/format";
import { isValidLatLng, quoteDelivery, roadDistanceKm, type DeliveryQuote, type DeliveryRate } from "@/lib/delivery";

type Props = {
  packages: { id: string; pricePerPax: number }[];
  addOns: { id: string; price: number }[];
  /** Keterangan di bawah angka (default: untuk pelanggan). */
  note?: string;
  /** Lokasi dapur + tarif vendor → ongkir dihitung dari pin `latitude`/`longitude` di form. */
  delivery?: { latitude: number; longitude: number; rate: DeliveryRate } | null;
};

/**
 * Estimasi harga yang ikut berubah saat pelanggan mengganti paket, jumlah tamu,
 * mencentang menu tambahan, atau menggeser pin lokasi (ongkir otomatis).
 */
export function LiveEstimate({ packages, addOns, note = "biaya lain ditetapkan vendor saat konfirmasi.", delivery }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ perPax: number; guests: number; quote: DeliveryQuote | null }>({
    perPax: 0,
    guests: 0,
    quote: null,
  });

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const prices = new Map(packages.map((p) => [p.id, p.pricePerPax]));
    const addOnPrices = new Map(addOns.map((a) => [a.id, a.price]));

    const evaluate = () => {
      const data = new FormData(form);
      const pkg = prices.get(String(data.get("packageId") ?? "")) ?? 0;
      const extra = data.getAll("addOnIds").reduce((sum, id) => sum + (addOnPrices.get(String(id)) ?? 0), 0);
      const guests = Math.max(0, Math.trunc(Number(data.get("guestCount")) || 0));
      const lat = Number(data.get("latitude"));
      const lng = Number(data.get("longitude"));
      const quote =
        delivery && data.get("latitude") && isValidLatLng(lat, lng)
          ? quoteDelivery(delivery.rate, roadDistanceKm(delivery, { latitude: lat, longitude: lng }))
          : null;
      setState({ perPax: pkg + extra, guests, quote });
    };

    evaluate();
    form.addEventListener("input", evaluate);
    form.addEventListener("change", evaluate);
    return () => {
      form.removeEventListener("input", evaluate);
      form.removeEventListener("change", evaluate);
    };
  }, [packages, addOns, delivery]);

  const subtotal = state.perPax * state.guests;
  const fee = state.quote?.inRange ? state.quote.fee : 0;

  return (
    <div ref={ref} aria-live="polite" className="space-y-1.5 rounded-2xl bg-sun-100 px-4 py-3 ring-1 ring-inset ring-sun-300">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-stone-700">Subtotal</span>
        <span className="font-semibold tabular-nums text-ink">{state.guests > 0 ? formatIDR(subtotal) : "—"}</span>
      </div>
      {delivery && (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-stone-700">
            Ongkir{state.quote ? ` (±${state.quote.distanceKm.toLocaleString("id-ID")} km)` : ""}
          </span>
          <span className="tabular-nums text-ink">
            {state.quote ? (state.quote.inRange ? formatIDR(state.quote.fee) : "di luar jangkauan") : "pilih lokasi"}
          </span>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3 border-t border-sun-300 pt-1.5">
        <span className="text-sm font-semibold text-stone-800">Estimasi total</span>
        <span className="font-display text-2xl text-ink">{state.guests > 0 ? formatIDR(subtotal + fee) : "—"}</span>
      </div>
      {state.quote && !state.quote.inRange && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
          Lokasi ±{state.quote.distanceKm.toLocaleString("id-ID")} km — melebihi jangkauan antar vendor ({state.quote.maxKm} km).
        </p>
      )}
      <p className="text-xs text-stone-600">
        {formatIDR(state.perPax)}/pax{state.guests > 0 ? ` × ${state.guests} pax` : " · isi jumlah tamu"} · {note}
      </p>
    </div>
  );
}
