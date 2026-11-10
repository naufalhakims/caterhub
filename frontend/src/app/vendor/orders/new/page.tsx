import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Flash } from "@/components/ui/Flash";
import { LiveEstimate } from "@/components/LiveEstimate";
import { LocationPicker } from "@/components/LocationPicker";
import { AutoDeliveryFee } from "@/components/AutoDeliveryFee";
import { apiGet } from "@/lib/api";
import { formatIDR, jakartaDateString } from "@/lib/format";
import { requireVendor } from "@/server/vendor-helpers";
import { createOfflineOrderAction } from "@/server/offline-actions";

type Pkg = { id: string; name: string; pricePerPax: number; minPax: number; maxPax: number; isActive: boolean };
type Menu = { id: string; name: string; price: number; isAvailable: boolean };

/**
 * Catat pesanan yang masuk lewat WhatsApp/telepon. Pesanan ikut memotong
 * kapasitas, masuk kalender, lembar produksi, dan mendapat nomor invoice.
 */
export default async function NewOfflineOrderPage({ searchParams }: { searchParams?: { error?: string } }) {
  const { vendor } = await requireVendor();
  const [packages, menus] = await Promise.all([
    apiGet<Pkg[]>("/api/v1/vendor/packages"),
    apiGet<Menu[]>("/api/v1/vendor/menu"),
  ]);
  const activePackages = packages.filter((p) => p.isActive);
  const addOns = menus.filter((m) => m.price > 0 && m.isAvailable);
  const kitchen =
    vendor.latitude != null && vendor.longitude != null
      ? {
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          rate: {
            deliveryBaseFee: vendor.deliveryBaseFee,
            deliveryBaseKm: vendor.deliveryBaseKm,
            deliveryPerKm: vendor.deliveryPerKm,
            deliveryMaxKm: vendor.deliveryMaxKm,
          },
        }
      : null;

  return (
    <div>
      <p className="text-sm text-stone-500">
        <Link href="/vendor/orders" className="hover:text-ink hover:underline">← Pesanan</Link>
      </p>
      <h1 className="mt-1 font-display text-4xl text-ink sm:text-5xl">
        Catat pesanan <em>offline</em>
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-500">
        Untuk pesanan yang masuk lewat WhatsApp, telepon, atau datang langsung. Dengan dicatat di sini, kapasitas harian,
        kalender, dan lembar produksi tetap akurat, dan pelanggan bisa diberi invoice resmi.
      </p>
      <Flash error={searchParams?.error} />

      {activePackages.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-stone-600">
            Buat minimal satu paket aktif dulu di halaman <Link href="/vendor/packages" className="font-semibold underline">Paket</Link>.
          </p>
        </Card>
      ) : (
        <form action={createOfflineOrderAction} className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Card className="!p-5">
              <h2 className="font-display text-2xl text-ink">Pelanggan</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Nama pelanggan">
                  <Input name="customerName" required minLength={2} maxLength={80} placeholder="cth. Ibu Ratna" />
                </Field>
                <Field label="Nomor WhatsApp (opsional)">
                  <Input name="customerPhone" type="tel" maxLength={20} placeholder="0812…" />
                </Field>
              </div>
            </Card>

            <Card className="!p-5">
              <h2 className="font-display text-2xl text-ink">Acara</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Nama acara">
                    <Input name="eventName" required minLength={3} maxLength={120} placeholder="cth. Arisan RT 05" />
                  </Field>
                </div>
                <Field label="Tanggal">
                  <Input name="eventDate" type="date" required min={jakartaDateString()} />
                </Field>
                <Field label="Jam">
                  <Input name="eventTime" type="time" required />
                </Field>
                <Field label="Jumlah porsi (pax)">
                  <Input name="guestCount" type="number" min={1} max={vendor.maxPax * 2} required placeholder="cth. 80" />
                </Field>
                <Field label="Kota">
                  <Select name="city" defaultValue={vendor.city}>
                    <option>Surabaya</option>
                    <option>Sidoarjo</option>
                    <option>Gresik</option>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">
                    Lokasi antar <span className="font-normal text-stone-500">(alamat & titik untuk ongkir otomatis)</span>
                  </span>
                  <LocationPicker
                    addressName="location"
                    addressPlaceholder="cth. Balai RW, Jl. Ketintang 12"
                    reference={kitchen ? { latitude: kitchen.latitude, longitude: kitchen.longitude, label: "Dapur Anda" } : null}
                    cityInputName="city"
                    height={220}
                    label="Lokasi antar"
                  />
                </div>
              </div>
            </Card>

            <Card className="!p-5">
              <h2 className="font-display text-2xl text-ink">Menu & biaya</h2>
              <div className="mt-3 space-y-3">
                <Field label="Paket">
                  <Select name="packageId" required defaultValue={activePackages[0]?.id}>
                    {activePackages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {formatIDR(p.pricePerPax)}/pax
                      </option>
                    ))}
                  </Select>
                </Field>
                {addOns.length > 0 && (
                  <fieldset className="rounded-2xl border border-stone-200 p-3">
                    <legend className="px-1 text-sm font-semibold text-ink">Menu tambahan (per pax)</legend>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {addOns.map((m) => (
                        <label key={m.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-paper has-[:checked]:bg-sun-100">
                          <span className="flex items-center gap-2">
                            <input type="checkbox" name="addOnIds" value={m.id} className="h-4 w-4 accent-ink" />
                            {m.name}
                          </span>
                          <span className="text-xs font-semibold text-stone-600">+{formatIDR(m.price)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Ongkos kirim (Rp)"><AutoDeliveryFee vendor={kitchen} /></Field>
                  <Field label="Biaya layanan (Rp)"><RupiahInput name="serviceFee" /></Field>
                  <Field label="Diskon (Rp)"><RupiahInput name="discount" /></Field>
                </div>
                <Field label="Catatan (opsional)">
                  <Textarea name="notes" rows={2} maxLength={1000} placeholder="cth. Antar sebelum jam 10, sambal dipisah." />
                </Field>
              </div>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="!rounded-4xl !p-5 shadow-lift">
              <h2 className="font-display text-2xl text-ink">Pembayaran</h2>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  ["NONE", "Belum dibayar", "Tandai lunas nanti dari daftar pesanan."],
                  ["CASH", "Sudah lunas (tunai)", "Tercatat sebagai pembayaran manual."],
                  ["TRANSFER", "Sudah lunas (transfer)", "Tercatat sebagai pembayaran manual."],
                ].map(([value, label, hint]) => (
                  <label key={value} className="flex cursor-pointer gap-3 rounded-2xl p-3 ring-1 ring-inset ring-stone-200 transition-colors has-[:checked]:bg-sun-100 has-[:checked]:ring-sun-400">
                    <input type="radio" name="payment" value={value} defaultChecked={value === "NONE"} className="mt-0.5 accent-ink" />
                    <span>
                      <span className="block font-semibold text-ink">{label}</span>
                      <span className="block text-xs text-stone-500">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <LiveEstimate
                  packages={activePackages.map((p) => ({ id: p.id, pricePerPax: p.pricePerPax }))}
                  addOns={addOns.map((m) => ({ id: m.id, price: m.price }))}
                  note="belum termasuk ongkir, biaya layanan, dan diskon."
                />
              </div>
              <SubmitButton requireDirty={false} arrow className="mt-4 w-full !py-3">
                Simpan pesanan
              </SubmitButton>
              <p className="mt-3 text-xs text-stone-500">Kapasitas dicek otomatis; pesanan ditolak bila dapur sudah penuh di tanggal itu.</p>
            </Card>
          </aside>
        </form>
      )}
    </div>
  );
}
