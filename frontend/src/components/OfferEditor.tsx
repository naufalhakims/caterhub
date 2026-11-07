"use client";

import { useEffect, useRef, useState } from "react";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { FormButton } from "@/components/ui/FormButton";
import { formatIDR } from "@/lib/format";
import { sendOfferAction } from "@/server/quotation-actions";

type Line = { key: number; name: string; quantity: number; unitPrice: number; menuItemId: string | null };

type Props = {
  quotationId: string;
  eventId: string;
  customerId: string;
  packageId: string | null;
  guestCount: number;
  items: { name: string; quantity: number; unitPrice: number; menuItemId?: string | null }[];
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  notes: string | null;
  submitLabel: string;
};

const fieldClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200";

/**
 * Editor penawaran khusus vendor: ubah item/harga, tambah baris, atur biaya,
 * lalu kirim ke pelanggan untuk diterima/ditolak/minta revisi. Total dihitung
 * ulang di layar; backend tetap menghitung ulang sebagai sumber kebenaran.
 */
export function OfferEditor(props: Props) {
  const [lines, setLines] = useState<Line[]>(() =>
    props.items.map((i, key) => ({ key, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, menuItemId: i.menuItemId ?? null })),
  );
  const nextKey = useRef(props.items.length);
  const formRef = useRef<HTMLFormElement>(null);
  const [totals, setTotals] = useState({ subtotal: 0, total: 0 });

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let frame = 0;
    const evaluate = () => {
      cancelAnimationFrame(frame);
      // Tunggu RupiahInput memperbarui hidden input-nya.
      frame = requestAnimationFrame(() => {
        const data = new FormData(form);
        const qty = data.getAll("itemQty").map((v) => Number(v) || 0);
        const price = data.getAll("itemPrice").map((v) => Number(v) || 0);
        const subtotal = qty.reduce((s, q, i) => s + q * (price[i] ?? 0), 0);
        const fee = (k: string) => Number(data.get(k)) || 0;
        setTotals({ subtotal, total: Math.max(0, subtotal + fee("deliveryFee") + fee("serviceFee") - fee("discount")) });
      });
    };
    evaluate();
    form.addEventListener("input", evaluate);
    form.addEventListener("change", evaluate);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("input", evaluate);
      form.removeEventListener("change", evaluate);
    };
  }, [lines.length]);

  const addLine = () =>
    setLines((ls) => [...ls, { key: nextKey.current++, name: "", quantity: props.guestCount, unitPrice: 0, menuItemId: null }]);
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  return (
    <form ref={formRef} action={sendOfferAction} className="space-y-4">
      <input type="hidden" name="quotationId" value={props.quotationId} />
      <input type="hidden" name="eventId" value={props.eventId} />
      <input type="hidden" name="customerId" value={props.customerId} />
      {props.packageId && <input type="hidden" name="packageId" value={props.packageId} />}

      <div>
        <div className="hidden grid-cols-[1fr_80px_150px_36px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500 sm:grid">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span>Harga satuan (Rp)</span>
          <span />
        </div>
        <div className="mt-1.5 space-y-2">
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-[1fr_80px] gap-2 rounded-2xl bg-paper p-2 sm:grid-cols-[1fr_80px_150px_36px] sm:bg-transparent sm:p-0">
              {/* Tautan menu dipertahankan agar baris tetap terhitung di lembar produksi. */}
              <input type="hidden" name="itemMenuId" value={l.menuItemId ?? ""} />
              <input
                name="itemName"
                defaultValue={l.name}
                required
                maxLength={120}
                placeholder="cth. Paket Prasmanan (100 pax)"
                aria-label="Nama item"
                className={`${fieldClass} col-span-2 sm:col-span-1`}
              />
              <input
                name="itemQty"
                type="number"
                min={1}
                defaultValue={l.quantity}
                required
                aria-label="Jumlah"
                className={`${fieldClass} text-right`}
              />
              <RupiahInput name="itemPrice" defaultValue={l.unitPrice} className="!rounded-xl !py-2" />
              <button
                type="button"
                onClick={() => removeLine(l.key)}
                disabled={lines.length === 1}
                aria-label="Hapus baris"
                className="col-span-2 rounded-xl text-sm text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:col-span-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-2 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
        >
          + Tambah item
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["deliveryFee", "Ongkos kirim (Rp)", props.deliveryFee],
            ["serviceFee", "Biaya layanan (Rp)", props.serviceFee],
            ["discount", "Diskon (Rp)", props.discount],
          ] as const
        ).map(([name, label, value]) => (
          <label key={name} className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
            <RupiahInput name={name} defaultValue={value} />
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Catatan untuk pelanggan</span>
          <textarea
            name="notes"
            rows={2}
            maxLength={2000}
            defaultValue={props.notes ?? ""}
            placeholder="cth. Rendang diganti ayam bakar karena stok daging terbatas."
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Berlaku</span>
          <select name="validDays" defaultValue="3" className={fieldClass}>
            <option value="1">1 hari</option>
            <option value="3">3 hari</option>
            <option value="7">7 hari</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sun-100 px-4 py-3 ring-1 ring-inset ring-sun-300">
        <div>
          <p className="text-xs text-stone-600">Subtotal {formatIDR(totals.subtotal)}</p>
          <p className="font-display text-2xl text-ink">Total {formatIDR(totals.total)}</p>
        </div>
        <FormButton arrow pendingLabel="Mengirim…">
          {props.submitLabel}
        </FormButton>
      </div>
    </form>
  );
}
