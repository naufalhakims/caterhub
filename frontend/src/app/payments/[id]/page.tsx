import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import QRCode from "qrcode";
import { FormButton } from "@/components/ui/FormButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Flash } from "@/components/ui/Flash";
import { formatDateID, formatDateTimeID, formatIDR } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";

type PaymentDetail = {
  id: string;
  bookingId: string;
  amount: number;
  status: string;
  provider: string;
  providerReference: string;
  qrPayload: string | null;
  expiresAt: string | null;
  booking: {
    event: { name: string; eventDate: string; eventTime: string | null };
    vendor: { businessName: string };
    quotation: {
      subtotal: number;
      deliveryFee: number;
      serviceFee: number;
      discount: number;
      items: { id: string; name: string; quantity: number; subtotal: number }[];
    };
  };
};

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  await requireUser();
  let payment: PaymentDetail;
  try {
    payment = await apiGet<PaymentDetail>(`/api/v1/payments/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  const isMock = payment.provider === "mock";
  const expired =
    payment.status === "EXPIRED" ||
    (payment.status === "PENDING" && !!payment.expiresAt && new Date(payment.expiresAt) < new Date());
  const payable = payment.status === "PENDING" && !expired;
  // QR dirender di server dari payload asli (mock: string QRIS demo; Midtrans: URL Snap).
  const qrSvg =
    payable && payment.qrPayload
      ? await QRCode.toString(payment.qrPayload, {
          type: "svg",
          margin: 0,
          errorCorrectionLevel: "M",
          color: { dark: "#1c1917", light: "#ffffff" },
        })
      : null;

  return (
    <>
      <Navbar />
      {/* Status berubah lewat webhook; segarkan halaman selama tagihan masih aktif. */}
      {payable && <AutoRefresh intervalMs={5000} />}
      <Flash error={searchParams?.error} />
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Pembayaran QRIS</p>
          <h1 className="mt-1 font-display text-4xl text-ink sm:text-5xl">{payment.booking.event.name}</h1>
          <p className="text-sm text-stone-500">
            {payment.booking.vendor.businessName} · {formatDateID(payment.booking.event.eventDate)}
            {payment.booking.event.eventTime ? ` · ${payment.booking.event.eventTime}` : ""}
          </p>
        </div>
        <Card className="mt-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Total pembayaran lunas</p>
          <p className="font-display text-4xl font-bold tracking-tight">{formatIDR(payment.amount)}</p>
          <div className="mt-2"><StatusBadge status={payment.status} /></div>

          <dl className="mt-4 space-y-1.5 rounded-xl bg-paper p-3 text-left text-xs ring-1 ring-inset ring-stone-200/70">
            {payment.booking.quotation.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-2">
                <dt className="text-stone-500">{item.name} × {item.quantity}</dt>
                <dd className="font-medium text-stone-700">{formatIDR(item.subtotal)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-200 pt-1.5">
              <dt className="text-stone-500">Ongkos kirim</dt>
              <dd className="font-medium text-stone-700">{formatIDR(payment.booking.quotation.deliveryFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Biaya layanan / lainnya</dt>
              <dd className="font-medium text-stone-700">{formatIDR(payment.booking.quotation.serviceFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Diskon</dt>
              <dd className="font-medium text-emerald-700">−{formatIDR(payment.booking.quotation.discount)}</dd>
            </div>
          </dl>

          <div className="mx-auto mt-5 max-w-[260px] rounded-2xl border-2 border-stone-900 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold tracking-tight">QRIS</p>
              <p className="text-[11px] font-bold text-stone-400">{isMock ? "SANDBOX" : "MIDTRANS"}</p>
            </div>
            {qrSvg ? (
              <div
                role="img"
                aria-label={`Kode QRIS untuk membayar ${formatIDR(payment.amount)}`}
                className="mx-auto mt-3 aspect-square w-full max-w-[200px] [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="mx-auto mt-3 grid aspect-square w-full max-w-[200px] place-items-center rounded-lg bg-stone-100 text-xs font-semibold text-stone-500">
                {payment.status === "SETTLEMENT" ? "Sudah dibayar" : "QR tidak berlaku"}
              </div>
            )}
            {payable && payment.expiresAt && (
              <p className="mt-2 text-[11px] font-medium text-stone-500">Berlaku sampai {formatDateTimeID(payment.expiresAt)} WIB</p>
            )}
            {payable && !isMock && (
              <a href={payment.qrPayload ?? "#"} target="_blank" rel="noreferrer" className="pressable mt-3 inline-block rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
                Buka halaman bayar
              </a>
            )}
          </div>

          <ol className="mx-auto mt-4 max-w-[280px] space-y-1 text-left text-xs text-stone-500">
            <li>1. Buka e-wallet / m-banking apa pun.</li>
            <li>2. Pindai QR di atas.</li>
            <li>3. Pastikan nominal {formatIDR(payment.amount)}.</li>
          </ol>

          <p className="mt-3 text-xs text-stone-400">Ref: {payment.providerReference}</p>
          {expired && (
            <p className="mt-4 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-medium text-stone-700 ring-1 ring-inset ring-stone-200">
              Tagihan ini sudah kedaluwarsa. Kembali ke pesanan untuk membuat tagihan baru.
            </p>
          )}
          {payment.status === "CANCELLED" && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200">
              Tagihan dibatalkan karena pesanan dibatalkan.
            </p>
          )}
          {payable && isMock && (
            <form action="/api/payments/mock-settle" method="post" className="mt-4">
              <input type="hidden" name="paymentId" value={payment.id} />
              <FormButton className="w-full !py-2.5" pendingLabel="Memproses pembayaran…">Simulasikan bayar (demo)</FormButton>
              <p className="mt-1.5 text-[11px] text-stone-400">Tombol demo — menggantikan pemindaian QR asli.</p>
            </form>
          )}
          {payment.status === "SETTLEMENT" && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              ✓ Pembayaran diterima. Terima kasih!
            </p>
          )}
          <p className="mt-4 text-sm">
            <Link href={`/bookings/${payment.bookingId}`} className="font-semibold text-brand-700 hover:underline">← Kembali ke pesanan</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
