"use client";

import { useEffect, useRef, useState } from "react";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { formatIDR } from "@/lib/format";
import { isValidLatLng, quoteDelivery, roadDistanceKm, type DeliveryQuote, type DeliveryRate } from "@/lib/delivery";

/**
 * Kolom ongkir yang terisi otomatis dari tarif vendor setiap kali pin lokasi
 * berubah, tetapi tetap bisa diubah manual (gang sempit, lantai atas, dll.).
 */
export function AutoDeliveryFee({
  name = "deliveryFee",
  vendor,
  initialFee = 0,
}: {
  name?: string;
  vendor: { latitude: number; longitude: number; rate: DeliveryRate } | null;
  initialFee?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [fee, setFee] = useState(initialFee);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form || !vendor) return;
    let last = "";
    const evaluate = () => {
      const data = new FormData(form);
      const key = `${data.get("latitude")},${data.get("longitude")}`;
      if (key === last) return; // hanya bereaksi pada perubahan pin
      last = key;
      const lat = Number(data.get("latitude"));
      const lng = Number(data.get("longitude"));
      if (!data.get("latitude") || !isValidLatLng(lat, lng)) return;
      const q = quoteDelivery(vendor.rate, roadDistanceKm(vendor, { latitude: lat, longitude: lng }));
      setQuote(q);
      if (q.inRange) setFee(q.fee);
    };
    evaluate();
    form.addEventListener("change", evaluate);
    return () => form.removeEventListener("change", evaluate);
  }, [vendor]);

  return (
    <div ref={ref}>
      {/* key: pasang ulang input saat tarif menghasilkan angka baru */}
      <RupiahInput key={fee} name={name} defaultValue={fee} />
      <p className="mt-1 text-xs text-stone-500">
        {!vendor
          ? "Atur lokasi dapur & tarif di Profil agar ongkir terhitung otomatis."
          : quote
            ? quote.inRange
              ? `Sesuai tarif: ±${quote.distanceKm.toLocaleString("id-ID")} km → ${formatIDR(quote.fee)} (boleh diubah).`
              : `±${quote.distanceKm.toLocaleString("id-ID")} km — di luar radius ${quote.maxKm} km; isi ongkir manual.`
            : "Taruh pin lokasi acara untuk menghitung ongkir otomatis."}
      </p>
    </div>
  );
}
