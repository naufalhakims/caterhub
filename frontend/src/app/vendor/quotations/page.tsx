import Link from "next/link";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { formatIDR, formatDateID } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import { declineQuotationRequestAction, sendQuotationAction } from "@/server/quotation-actions";
import { QUOTATION_ORIGIN_LABEL } from "@/server/quotation-workflow";

type VendorQuote = {
  id: string;
  origin: string;
  status: string;
  total: number;
  event: {
    name: string;
    guestCount: number;
    eventDate: string;
    location: string;
    budgetMax: number | null;
  };
};

type ComposeQuote = {
  id: string;
  eventId: string;
  customerId: string;
  packageId: string | null;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  notes: string | null;
  revisionNote: string | null;
  event: {
    name: string;
    guestCount: number;
    eventDate: string;
    location: string;
    budgetMax: number | null;
  };
  items: { id: string; name: string; quantity: number; unitPrice: number }[];
};

export default async function VendorQuotationsPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string; compose?: string };
}) {
  await requireVendor();
  const [quotes, packages] = await Promise.all([
    apiGet<VendorQuote[]>("/api/v1/vendor/quotations"),
    apiGet<{ id: string }[]>("/api/v1/vendor/packages"),
  ]);
  // Pisahkan tegas: permintaan pelanggan tidak pernah tampil sebagai penawaran vendor.
  const requests = quotes.filter((q) => q.origin === "CUSTOMER_REQUEST" && q.status === "REQUESTED");
  const handledRequests = quotes.filter((q) => q.origin === "CUSTOMER_REQUEST" && q.status !== "REQUESTED");
  const offers = quotes.filter((q) => q.origin === "VENDOR_OFFER");
  let compose: ComposeQuote | null = null;
  if (searchParams?.compose) {
    try {
      compose = await apiGet<ComposeQuote>(`/api/v1/quotations/${searchParams.compose}`);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return <p className="text-sm text-red-600">Akses ditolak.</p>;
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Permintaan & penawaran</h1>
      <p className="text-sm text-stone-500">
        Permintaan pelanggan butuh keputusan Anda dulu; penawaran vendor adalah tawaran yang Anda kirim langsung.
      </p>
      {searchParams?.ok && <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
      {searchParams?.error && <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

      <h2 className="mt-5 font-display text-lg font-bold">
        Permintaan pelanggan
        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 align-middle font-sans text-xs font-bold text-amber-800">{requests.length}</span>
      </h2>
      <p className="text-[13px] text-stone-500">Pelanggan meminta penawaran. Putuskan: kirim penawaran atau tolak dengan alasan.</p>
      <div className="mt-2 space-y-2">
        {requests.map((q) => (
          <Card key={q.id} className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/quotations/${q.id}`} className="font-semibold hover:text-brand-700 hover:underline">
                  {q.event.name} · {q.event.guestCount} pax
                </Link>
                <p className="text-sm text-stone-500">
                  {formatDateID(q.event.eventDate)} · {q.event.location} · estimasi {formatIDR(q.total)}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-stone-400">{QUOTATION_ORIGIN_LABEL[q.origin]}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/vendor/quotations?compose=${q.id}`} className="rounded-xl bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800">
                  Susun penawaran
                </Link>
                <form action={declineQuotationRequestAction}>
                  <input type="hidden" name="quotationId" value={q.id} />
                  <Button type="submit" variant="secondary" className="!py-1.5 !text-xs">Tolak</Button>
                </form>
              </div>
            </div>
          </Card>
        ))}
        {requests.length === 0 && <p className="text-sm text-stone-500">Tidak ada permintaan baru.</p>}
      </div>

      {compose && (
        <Card className="mt-4 border-brand-100 !bg-gradient-to-b !from-brand-50 !to-white">
          <h2 className="font-display text-lg font-bold">Susun penawaran — {compose.event.name}</h2>
          <p className="text-sm text-stone-500">
            {formatDateID(compose.event.eventDate)} · {compose.event.guestCount} pax · {compose.event.location}
            {compose.event.budgetMax != null && <> · budget {formatIDR(compose.event.budgetMax)}</>}
          </p>
          {compose.revisionNote && <p className="mt-2 rounded-xl bg-purple-50 px-3.5 py-2.5 text-sm text-purple-800 ring-1 ring-inset ring-purple-200">Permintaan revisi: {compose.revisionNote}</p>}
          <form action={sendQuotationAction} className="mt-3 space-y-3">
            <input type="hidden" name="quotationId" value={compose.id} />
            <input type="hidden" name="eventId" value={compose.eventId} />
            <input type="hidden" name="customerId" value={compose.customerId} />
            <input type="hidden" name="packageId" value={compose.packageId ?? packages[0]?.id ?? ""} />
            <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-2 py-2 text-right">Qty (pax)</th>
                    <th className="px-2 py-2 text-right">Harga/pax</th>
                  </tr>
                </thead>
                <tbody>
                  {compose.items.map((it, idx) => (
                    <tr key={it.id} className="border-t border-stone-100">
                      <td className="px-3 py-1.5"><input name={`itemName${idx}`} defaultValue={it.name} required className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500" /></td>
                      <td className="px-2 py-1.5"><input name={`itemQty${idx}`} type="number" min={1} defaultValue={it.quantity} required className="w-20 rounded-lg border border-stone-200 px-2 py-1.5 text-right text-sm outline-none focus:border-brand-500" /></td>
                      <td className="px-2 py-1.5"><RupiahInput name={`itemPrice${idx}`} defaultValue={it.unitPrice} required className="!w-28 !rounded-lg !py-1.5 !text-right" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <input type="hidden" name="itemsJson" value="" />
            <p className="text-xs text-stone-400">Ubah langsung di tabel — total dihitung otomatis oleh server.</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Ongkir (Rp)"><RupiahInput name="deliveryFee" defaultValue={compose.deliveryFee} /></Field>
              <Field label="Layanan (Rp)"><RupiahInput name="serviceFee" defaultValue={compose.serviceFee} /></Field>
              <Field label="Diskon (Rp)"><RupiahInput name="discount" defaultValue={compose.discount} /></Field>
              <Field label="Berlaku hingga"><Input name="expiresAt" type="date" /></Field>
            </div>
            <Field label="Catatan untuk pelanggan"><Textarea name="notes" rows={2} defaultValue={compose.notes ?? ""} placeholder="cth. Sudah termasuk alat makan & pramusaji." /></Field>
            <SubmitButton requireDirty={false} className="!px-6 !py-2.5">Kirim penawaran →</SubmitButton>
          </form>
        </Card>
      )}

      <h2 className="mt-7 font-display text-lg font-bold">Penawaran</h2>
      <p className="text-[13px] text-stone-500">Riwayat penawaran yang Anda kirim (termasuk hasil negosiasi permintaan pelanggan).</p>
      <div className="mt-2 space-y-2.5">
        {offers.map((q) => (
          <Card key={q.id} className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/quotations/${q.id}`} className="font-semibold hover:text-brand-700 hover:underline">
                  {q.event.name} · {q.event.guestCount} pax
                </Link>
                <p className="text-sm text-stone-500">{formatDateID(q.event.eventDate)} · {formatIDR(q.total)}</p>
                <p className="text-[11px] uppercase tracking-wide text-stone-400">{QUOTATION_ORIGIN_LABEL[q.origin]}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={q.status} />
                {(q.status === "SENT" || q.status === "REVISION_REQUESTED") && (
                  <Link href={`/vendor/quotations?compose=${q.id}`} className="rounded-xl bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800">
                    Susun / revisi
                  </Link>
                )}
              </div>
            </div>
          </Card>
        ))}
        {offers.length === 0 && (
          <Empty title="Belum ada penawaran." hint="Pastikan profil terverifikasi dan paket sudah aktif agar muncul di marketplace." />
        )}
      </div>

      {handledRequests.length > 0 && (
        <>
          <h2 className="mt-7 font-display text-lg font-bold">Permintaan yang sudah ditangani</h2>
          <p className="text-[13px] text-stone-500">Arsip permintaan pelanggan beserta hasilnya.</p>
          <div className="mt-2 space-y-2">
            {handledRequests.map((q) => (
              <Card key={q.id} className="!p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link href={`/quotations/${q.id}`} className="font-semibold hover:text-brand-700 hover:underline">
                    {q.event.name} · {q.event.guestCount} pax
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-stone-500">
                    {formatDateID(q.event.eventDate)}
                    <StatusBadge status={q.status} />
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
