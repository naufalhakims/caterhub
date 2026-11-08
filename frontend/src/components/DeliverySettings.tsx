import { Card } from "@/components/ui/Card";
import { FormButton } from "@/components/ui/FormButton";
import { Input } from "@/components/ui/Field";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { LocationPicker } from "@/components/LocationPicker";
import { formatIDR } from "@/lib/format";
import { quoteDelivery, type DeliveryRate } from "@/lib/delivery";
import { saveDeliverySettingsAction } from "@/server/vendor-actions";

const EXAMPLES = [2, 5, 10, 20];

/** Pengaturan vendor: titik dapur + tarif ongkir otomatis, dengan contoh hitungan. */
export function DeliverySettings({
  vendor,
}: {
  vendor: DeliveryRate & { latitude: number | null; longitude: number | null };
}) {
  const hasPin = vendor.latitude != null && vendor.longitude != null;
  return (
    <Card className="mt-4">
      <h2 className="font-display text-2xl text-ink">
        Lokasi dapur & <em>tarif ongkir</em>
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-stone-600">
        Ongkir dihitung otomatis dari jarak dapur ke lokasi acara (perkiraan jarak jalan) — pelanggan langsung melihatnya
        saat memesan, dan Anda tetap bisa menyesuaikannya ketika mengonfirmasi.
      </p>
      {!hasPin && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          Lokasi dapur belum diatur — ongkir masih harus diisi manual di setiap pesanan.
        </p>
      )}
      <form action={saveDeliverySettingsAction} className="mt-4 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <LocationPicker
          initial={hasPin ? { latitude: vendor.latitude!, longitude: vendor.longitude! } : null}
          label="Lokasi dapur"
          height={280}
        />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Tarif dasar</span>
              <RupiahInput name="deliveryBaseFee" defaultValue={vendor.deliveryBaseFee} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Untuk jarak s.d. (km)</span>
              <Input name="deliveryBaseKm" type="number" min={0} max={100} step="0.5" defaultValue={vendor.deliveryBaseKm} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Per km berikutnya</span>
              <RupiahInput name="deliveryPerKm" defaultValue={vendor.deliveryPerKm} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Radius maks. (km)</span>
              <Input name="deliveryMaxKm" type="number" min={1} max={200} step="1" defaultValue={vendor.deliveryMaxKm} required />
            </label>
          </div>
          <div className="rounded-2xl bg-paper p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Contoh dengan tarif tersimpan</p>
            <ul className="mt-1.5 space-y-0.5">
              {EXAMPLES.map((km) => {
                const q = quoteDelivery(vendor, km);
                return (
                  <li key={km} className="flex justify-between tabular-nums">
                    <span className="text-stone-600">±{km} km</span>
                    <span className="font-semibold text-ink">{q.inRange ? formatIDR(q.fee) : "di luar jangkauan"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-xs text-stone-500">Sisa km dibulatkan ke atas. Jarak = garis lurus × 1,3 (perkiraan jalan).</p>
          </div>
          <FormButton pendingLabel="Menyimpan…" className="w-full">
            Simpan lokasi & tarif
          </FormButton>
        </div>
      </form>
    </Card>
  );
}
