import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";
import { ApiError, apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";
import { formatDateID, formatDateTimeID, formatIDR } from "@/lib/format";

type Invoice = {
  invoiceNumber: string;
  issuedAt: string;
  status: string;
  source: string;
  paidInFull: boolean;
  paidAt: string | null;
  paidAmount: number;
  vendor: { businessName: string; address: string | null; city: string; phone: string | null; logoUrl: string | null };
  customer: { name: string | null; email: string | null; phone: string | null; address: string | null; city: string | null };
  event: { name: string; eventDate: string; eventTime: string | null; guestCount: number; location: string; city: string };
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  payments: { id: string; amount: number; method: string; provider: string; paidAt: string | null }[];
};

const METHOD: Record<string, string> = { QRIS: "QRIS", CASH: "Tunai", TRANSFER: "Transfer bank" };
const CLOSED = new Set(["CANCELLED", "REFUND_PENDING", "REFUNDED"]);

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `Invoice ${params.id.slice(-6).toUpperCase()} · CaterHub` };
}

/**
 * Invoice (tagihan) yang otomatis menjadi kuitansi bercap LUNAS setelah dibayar.
 * Didesain untuk layar dan kertas A4; "Unduh PDF" memakai Simpan sebagai PDF browser.
 */
export default async function InvoicePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  let inv: Invoice;
  try {
    inv = await apiGet<Invoice>(`/api/v1/bookings/${params.id}/invoice`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  const closed = CLOSED.has(inv.status);
  const stamp = closed
    ? { text: "DIBATALKAN", tone: "border-red-600 text-red-600" }
    : inv.paidInFull
      ? { text: "LUNAS", tone: "border-emerald-600 text-emerald-700" }
      : { text: "BELUM LUNAS", tone: "border-tangerine text-tangerine" };
  const title = inv.paidInFull && !closed ? "Kuitansi" : "Invoice";
  const back = user.role === "VENDOR" ? "/vendor/orders" : user.role === "ADMIN" ? "/admin/orders" : `/bookings/${params.id}`;

  return (
    <main className="min-h-screen bg-paper px-3 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[52rem] flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={back} className="text-sm text-stone-600 hover:text-ink hover:underline">
          ← Kembali
        </Link>
        <div className="flex gap-2">
          <PrintButton label="Cetak / Unduh PDF" />
        </div>
      </div>

      <article className="mx-auto max-w-[52rem] overflow-hidden rounded-3xl bg-white p-8 shadow-lift ring-1 ring-stone-200 sm:p-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-stone-200 pb-6">
          <div className="flex items-center gap-4">
            {inv.vendor.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={inv.vendor.logoUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-1 ring-stone-200" />
            )}
            <div>
              <p className="font-display text-3xl leading-tight text-ink">{inv.vendor.businessName}</p>
              <p className="mt-1 text-sm text-stone-600">
                {[inv.vendor.address, inv.vendor.city].filter(Boolean).join(", ")}
                {inv.vendor.phone ? ` · ${inv.vendor.phone}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="font-display text-4xl text-ink">
              <em>{title}</em>
            </h1>
            <p className="mt-1 font-mono text-sm text-stone-700">{inv.invoiceNumber}</p>
            <p className="text-xs text-stone-500">Diterbitkan {formatDateID(inv.issuedAt)}</p>
          </div>
        </header>

        <section className="grid gap-6 py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Ditagihkan kepada</p>
            <p className="mt-1.5 font-semibold text-ink">{inv.customer.name ?? "Pelanggan"}</p>
            {inv.customer.phone && <p className="text-stone-600">{inv.customer.phone}</p>}
            {inv.customer.email && <p className="text-stone-600">{inv.customer.email}</p>}
            {inv.customer.address && (
              <p className="text-stone-600">{[inv.customer.address, inv.customer.city].filter(Boolean).join(", ")}</p>
            )}
            {inv.source === "OFFLINE" && <p className="mt-1 text-xs text-stone-400">Pesanan dicatat langsung oleh vendor.</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Acara</p>
            <p className="mt-1.5 font-semibold text-ink">{inv.event.name}</p>
            <p className="text-stone-600">
              {formatDateID(inv.event.eventDate)}
              {inv.event.eventTime ? ` · ${inv.event.eventTime}` : ""} · {inv.event.guestCount} pax
            </p>
            <p className="text-stone-600">
              {inv.event.location}, {inv.event.city}
            </p>
          </div>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="py-2.5 font-semibold">Deskripsi</th>
              <th className="py-2.5 text-right font-semibold">Qty</th>
              <th className="py-2.5 text-right font-semibold">Harga</th>
              <th className="py-2.5 text-right font-semibold">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((i, idx) => (
              <tr key={idx} className="border-b border-stone-100">
                <td className="py-2.5 pr-3">{i.name}</td>
                <td className="py-2.5 text-right tabular-nums">{i.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">{formatIDR(i.unitPrice)}</td>
                <td className="py-2.5 text-right font-medium tabular-nums">{formatIDR(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex flex-col-reverse items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Cap status di ruang kosong samping total, seperti kuitansi kertas. */}
          <span
            aria-label={`Status: ${stamp.text}`}
            className={`mt-2 rotate-[-10deg] rounded-xl border-4 px-5 py-2 font-display text-4xl tracking-wider opacity-80 sm:ml-6 sm:mt-6 ${stamp.tone}`}
          >
            {stamp.text}
          </span>
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd className="tabular-nums">{formatIDR(inv.subtotal)}</dd></div>
            {inv.deliveryFee > 0 && <div className="flex justify-between"><dt className="text-stone-500">Ongkos kirim</dt><dd className="tabular-nums">{formatIDR(inv.deliveryFee)}</dd></div>}
            {inv.serviceFee > 0 && <div className="flex justify-between"><dt className="text-stone-500">Biaya layanan</dt><dd className="tabular-nums">{formatIDR(inv.serviceFee)}</dd></div>}
            {inv.discount > 0 && <div className="flex justify-between"><dt className="text-stone-500">Diskon</dt><dd className="tabular-nums text-emerald-700">−{formatIDR(inv.discount)}</dd></div>}
            <div className="flex items-baseline justify-between border-t border-stone-300 pt-2">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-display text-2xl text-ink">{formatIDR(inv.total)}</dd>
            </div>
            <div className="flex justify-between"><dt className="text-stone-500">Dibayar</dt><dd className="tabular-nums text-emerald-700">{formatIDR(inv.paidAmount)}</dd></div>
            {!inv.paidInFull && !closed && (
              <div className="flex justify-between font-semibold"><dt>Sisa tagihan</dt><dd className="tabular-nums text-tangerine">{formatIDR(inv.total - inv.paidAmount)}</dd></div>
            )}
          </dl>
        </section>

        {inv.payments.length > 0 && (
          <section className="mt-6 rounded-2xl bg-paper p-4 text-sm print:border print:border-stone-200 print:bg-white">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Riwayat pembayaran</p>
            <ul className="mt-2 space-y-1">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span>
                    {METHOD[p.method] ?? p.method}
                    {p.provider === "manual" ? " (dicatat vendor)" : ""} · {p.paidAt ? formatDateTimeID(p.paidAt) : "—"}
                  </span>
                  <span className="tabular-nums">{formatIDR(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-10 flex flex-wrap items-end justify-between gap-4 border-t border-stone-200 pt-5 text-xs text-stone-500">
          <p className="max-w-md">
            Dokumen ini diterbitkan secara elektronik melalui CaterHub dan sah tanpa tanda tangan. Simpan nomor invoice untuk
            keperluan konfirmasi atau reimburse.
          </p>
          <Logo className="text-xl" />
        </footer>
      </article>
    </main>
  );
}
