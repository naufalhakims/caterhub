import Link from "next/link";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Textarea } from "@/components/ui/Field";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { formatIDR, formatDateID } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import { Flash } from "@/components/ui/Flash";
import { ArrowRight, buttonLink } from "@/components/ui/Button";
import {
  confirmQuotationRequestAction,
  declineQuotationRequestAction,
} from "@/server/quotation-actions";

type VendorQuote = {
  id: string;
  origin: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  notes: string | null;
  revisionNote: string | null;
  expiresAt: string | null;
  event: {
    name: string;
    guestCount: number;
    eventDate: string;
    eventTime: string | null;
    location: string;
    budgetMax: number | null;
  };
  package: { id: string; name: string } | null;
};

export default async function VendorQuotationsPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  await requireVendor();
  const quotes = await apiGet<VendorQuote[]>("/api/v1/vendor/quotations");
  const requests = quotes.filter((q) => q.status === "REQUESTED");
  const revisions = quotes.filter((q) => q.status === "REVISION_REQUESTED");
  const awaiting = quotes.filter((q) => q.status === "SENT");
  const handledRequests = quotes.filter(
    (q) => !["REQUESTED", "REVISION_REQUESTED", "SENT"].includes(q.status),
  );

  return (
    <div>
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Permintaan pesanan</h1>
      <p className="text-sm text-stone-500">
        Konfirmasi langsung, ajukan penawaran khusus bila menu/harga perlu disesuaikan, atau tolak dengan alasan.
        Setelah pesanan dibuat, pelanggan membayar lunas dan Anda baru bisa mulai persiapan.
      </p>
      <Flash ok={searchParams?.ok} error={searchParams?.error} />

      {revisions.length > 0 && (
        <>
          <h2 className="mt-6 font-display text-2xl text-ink">
            Revisi diminta
            <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 align-middle font-sans text-xs font-bold text-purple-800">
              {revisions.length}
            </span>
          </h2>
          <div className="mt-2 space-y-3">
            {revisions.map((q) => (
              <Card key={q.id} className="!border-purple-200 !p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{q.event.name} · {q.event.guestCount} pax</p>
                    <p className="text-sm text-stone-500">
                      {formatDateID(q.event.eventDate)} · penawaran terakhir {formatIDR(q.total)}
                    </p>
                    {q.revisionNote && <p className="mt-1.5 text-sm text-purple-900">“{q.revisionNote}”</p>}
                  </div>
                  <StatusBadge status={q.status} />
                </div>
                <Link href={`/quotations/${q.id}`} className={buttonLink("primary", "mt-3 !pr-4")}>
                  Perbarui penawaran
                  <ArrowRight className="ml-2" />
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-6 font-display text-2xl text-ink">
        Permintaan baru
        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle font-sans text-xs font-bold text-amber-800">
          {requests.length}
        </span>
      </h2>
      <div className="mt-2 space-y-3">
        {requests.map((q) => (
          <Card key={q.id} className="!p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/quotations/${q.id}`}
                  className="font-semibold hover:text-brand-700 hover:underline"
                >
                  {q.event.name} · {q.event.guestCount} pax
                </Link>
                <p className="text-sm text-stone-500">
                  {formatDateID(q.event.eventDate)}
                  {q.event.eventTime ? ` · ${q.event.eventTime}` : ""} · {q.event.location}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">
                  {q.package ? `Paket ${q.package.name}` : "Paket kustom"} · subtotal{" "}
                  <span className="font-semibold text-stone-700">{formatIDR(q.subtotal)}</span>
                </p>
                {q.notes && <p className="mt-1 text-sm text-stone-500">Catatan: {q.notes}</p>}
              </div>
              <StatusBadge status={q.status} />
            </div>

            <details className="mt-3 rounded-xl bg-paper p-3 ring-1 ring-inset ring-stone-200/70">
              <summary className="cursor-pointer text-sm font-semibold text-brand-800">
                Konfirmasi pesanan & atur biaya tambahan
              </summary>
              <form action={confirmQuotationRequestAction} className="mt-3 space-y-3">
                <input type="hidden" name="quotationId" value={q.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Ongkos kirim (Rp)">
                    <RupiahInput name="deliveryFee" defaultValue={q.deliveryFee} />
                  </Field>
                  <Field label="Biaya layanan / lainnya (Rp)">
                    <RupiahInput name="serviceFee" defaultValue={q.serviceFee} />
                  </Field>
                  <Field label="Diskon (Rp, opsional)">
                    <RupiahInput name="discount" defaultValue={q.discount} />
                  </Field>
                </div>
                <p className="text-xs text-stone-500">
                  Total nota = subtotal + ongkir + biaya layanan − diskon. Total ini otomatis
                  masuk ke nota pelanggan saat pembayaran lunas.
                </p>
                <SubmitButton requireDirty={false} className="!px-5 !py-2">
                  ✓ Konfirmasi pesanan
                </SubmitButton>
              </form>
            </details>

            <Link
              href={`/quotations/${q.id}`}
              className="mt-2 inline-block rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              Ajukan penawaran khusus (ubah item / harga) →
            </Link>
            <details className="mt-1">
              <summary className="cursor-pointer px-3 text-xs font-semibold text-red-600">
                Tolak permintaan…
              </summary>
              <form action={declineQuotationRequestAction} className="mt-2 space-y-2">
                <input type="hidden" name="quotationId" value={q.id} />
                <Field label="Alasan (dikirim ke pelanggan)">
                  <Textarea
                    name="reason"
                    rows={2}
                    required
                    maxLength={500}
                    placeholder="cth. Tanggal tersebut kapasitas dapur sudah penuh."
                  />
                </Field>
                <SubmitButton variant="danger" className="!py-1.5 !text-xs">
                  Tolak permintaan
                </SubmitButton>
              </form>
            </details>
          </Card>
        ))}
        {requests.length === 0 && (
          <Empty
            title="Tidak ada permintaan baru."
            hint="Permintaan pelanggan akan muncul di sini untuk Anda konfirmasi."
          />
        )}
      </div>

      {awaiting.length > 0 && (
        <>
          <h2 className="mt-7 font-display text-2xl text-ink">Menunggu keputusan pelanggan</h2>
          <div className="mt-2 space-y-2">
            {awaiting.map((q) => (
              <Link key={q.id} href={`/quotations/${q.id}`} className="block">
                <Card interactive className="!p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">
                      {q.event.name} · {q.event.guestCount} pax · {formatIDR(q.total)}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-stone-500">
                      {q.expiresAt ? `berlaku s.d. ${formatDateID(q.expiresAt)}` : formatDateID(q.event.eventDate)}
                      <StatusBadge status={q.status} />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {handledRequests.length > 0 && (
        <>
          <h2 className="mt-7 font-display text-2xl text-ink">Sudah ditangani</h2>
          <div className="mt-2 space-y-2">
            {handledRequests.map((q) => (
              <Card key={q.id} className="!p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/quotations/${q.id}`}
                    className="font-semibold hover:text-brand-700 hover:underline"
                  >
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
