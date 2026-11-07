"use client";

import { useEffect, useRef, useState } from "react";
import { formatIDR } from "@/lib/format";

type Props = {
  packages: { id: string; pricePerPax: number }[];
  addOns: { id: string; price: number }[];
  /** Keterangan di bawah angka (default: untuk pelanggan). */
  note?: string;
};

/**
 * Estimasi harga yang ikut berubah saat pelanggan mengganti paket, jumlah tamu,
 * atau mencentang menu tambahan. Hanya perkiraan: ongkir & biaya lain
 * ditetapkan vendor saat konfirmasi.
 */
export function LiveEstimate({ packages, addOns, note = "ongkir & biaya lain ditetapkan vendor saat konfirmasi." }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ perPax: 0, guests: 0 });

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
      setState({ perPax: pkg + extra, guests });
    };

    evaluate();
    form.addEventListener("input", evaluate);
    form.addEventListener("change", evaluate);
    return () => {
      form.removeEventListener("input", evaluate);
      form.removeEventListener("change", evaluate);
    };
  }, [packages, addOns]);

  return (
    <div ref={ref} aria-live="polite" className="rounded-2xl bg-sun-100 px-4 py-3 ring-1 ring-inset ring-sun-300">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-stone-700">Estimasi subtotal</span>
        <span className="font-display text-2xl text-ink">
          {state.guests > 0 ? formatIDR(state.perPax * state.guests) : "—"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-stone-600">
        {formatIDR(state.perPax)}/pax{state.guests > 0 ? ` × ${state.guests} pax` : " · isi jumlah tamu"} · {note}
      </p>
    </div>
  );
}
