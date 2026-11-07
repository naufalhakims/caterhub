import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import { FormButton } from "@/components/ui/FormButton";
import { OrderStepper } from "@/components/OrderStepper";
import { CancelBookingForm } from "@/components/CancelBookingForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { StarRatingInput } from "@/components/ui/StarRatingInput";
import { Field, Textarea } from "@/components/ui/Field";
import { formatIDR, formatDateID, formatDateTimeID, todayDateOnly, toDateOnly } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";
import { createPaymentAction } from "@/server/payment-actions";
import { createBookingReviewAction } from "@/server/booking-actions";
import { Flash } from "@/components/ui/Flash";

/** Harus sama dengan CUSTOMER_CANCEL_MIN_DAYS di backend (domain/booking.ts). */
const CUSTOMER_CANCEL_MIN_DAYS = 3;
const UNPAID_CANCELLABLE = ["PAYMENT_PENDING", "CONFIRMED"];
const PAID_CANCELLABLE = ["PAID", "PREPARING"];

type BookingDetail = {
  id: string;
  status: string;
  totalAmount: number;
  quotationId: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  paymentDueAt: string | null;
  refundAmount: number | null;
  refundedAt: string | null;
  customerId: string;
  event: {
    name: string;
    eventDate: string;
    eventTime: string | null;
    guestCount: number;
    location: string;
    city: string;
  };
  vendor: { id: string; businessName: string; userId: string };
  quotation: {
    subtotal: number;
    deliveryFee: number;
    serviceFee: number;
    discount: number;
    items: { id: string; name: string; quantity: number; unitPrice: number; subtotal: number }[];
  };
  payments: { id: string; amount: number; status: string; expiresAt: string | null }[];
  review: { id: string; rating: number; comment: string | null; createdAt: string } | null;
};

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  const user = await requireUser();
  let booking: BookingDetail;
  try {
    booking = await apiGet<BookingDetail>(`/api/v1/bookings/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  const paid = booking.payments.filter((p) => p.status === "SETTLEMENT").reduce((s, p) => s + p.amount, 0);
  const isCustomer = user.id === booking.customerId;
  const isAdmin = user.role === "ADMIN";
  const canPay = ["PAYMENT_PENDING", "CONFIRMED"].includes(booking.status);
  const canReview =
    isCustomer &&
    paid >= booking.totalAmount &&
    ["PAID", "PREPARING", "READY", "DELIVERED", "COMPLETED"].includes(booking.status);
  const isVendor = user.id === booking.vendor.userId;
  // Kembali ke antarmuka peran masing-masing — admin tidak boleh nyasar ke halaman vendor.
  const backHref = isAdmin ? "/admin/orders" : isCustomer ? "/dashboard" : "/vendor/orders";
  const dueAt = booking.paymentDueAt ? new Date(booking.paymentDueAt) : null;
  const daysUntilEvent = Math.round(
    (toDateOnly(booking.event.eventDate).getTime() - todayDateOnly().getTime()) / 86_400_000,
  );
  const canCancel =
    UNPAID_CANCELLABLE.includes(booking.status) ||
    (PAID_CANCELLABLE.includes(booking.status) &&
      (isVendor || daysUntilEvent >= CUSTOMER_CANCEL_MIN_DAYS));
  const cancelConsequence = paid > 0
    ? `Dana ${formatIDR(paid)} akan dikembalikan melalui admin. Jadwal vendor pada tanggal ini akan dilepas.`
    : "Jadwal vendor pada tanggal ini akan dilepas dan tagihan yang belum dibayar dibatalkan.";
  const cancelledByLabel =
    booking.cancelledBy === "CUSTOMER" ? "pelanggan" : booking.cancelledBy === "VENDOR" ? "vendor" : booking.cancelledBy === "SYSTEM" ? "sistem" : null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-stone-500">
          <Link href={backHref} className="hover:text-brand-700 hover:underline">← Kembali</Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-4xl text-ink sm:text-5xl">{booking.event.name}</h1>
          <StatusBadge status={booking.status} />
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {booking.vendor.businessName} · {formatDateID(booking.event.eventDate)}
          {booking.event.eventTime ? ` · ${booking.event.eventTime}` : ""} · {booking.event.guestCount} pax
        </p>
        <Flash ok={searchParams?.ok} error={searchParams?.error} />

        {/* Tahap & status */}
        {["CANCELLED", "REFUND_PENDING", "REFUNDED"].includes(booking.status) ? (
          <Card className="mt-4 !border-red-200 !bg-red-50/60">
            <p className="font-semibold text-red-800">
              Pesanan dibatalkan{cancelledByLabel ? ` oleh ${cancelledByLabel}` : ""}
              {booking.cancelledAt ? ` · ${formatDateTimeID(booking.cancelledAt)}` : ""}
            </p>
            {booking.cancelReason && <p className="mt-1 text-sm text-red-700">Alasan: {booking.cancelReason}</p>}
            <p className="mt-1 text-sm text-red-700">Jadwal vendor pada tanggal acara sudah dilepas.</p>
            {booking.status === "REFUND_PENDING" && (
              <p className="mt-3 rounded-xl bg-white/80 px-3.5 py-2.5 text-sm font-medium text-orange-800 ring-1 ring-inset ring-orange-200">
                Refund {formatIDR(booking.refundAmount ?? paid)} sedang diproses admin. Anda akan menerima notifikasi setelah dana dikirim.
              </p>
            )}
            {booking.status === "REFUNDED" && (
              <p className="mt-3 rounded-xl bg-white/80 px-3.5 py-2.5 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                ✓ Dana {formatIDR(booking.refundAmount ?? paid)} sudah dikembalikan
                {booking.refundedAt ? ` pada ${formatDateID(booking.refundedAt)}` : ""}.
              </p>
            )}
          </Card>
        ) : (
          <Card className="mt-4">
            <OrderStepper status={booking.status} />
            {booking.status === "PAYMENT_PENDING" && dueAt && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                Lunasi sebelum <span className="font-semibold">{formatDateTimeID(dueAt)} WIB</span>. Setelah itu pesanan
                dibatalkan otomatis dan jadwal vendor dibuka untuk pelanggan lain.
              </p>
            )}
          </Card>
        )}

        <Card className="mt-4">
          <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-stone-400">Lokasi acara</dt>
              <dd className="mt-0.5 font-medium">{booking.event.location}, {booking.event.city}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-stone-400">Rincian pesanan</dt>
              <dd className="mt-0.5"><Link href={`/quotations/${booking.quotationId}`} className="font-semibold text-brand-700 hover:underline">Lihat rincian →</Link></dd>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-inset ring-stone-200/70">
            <div className="bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Nota pesanan</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {booking.quotation.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span className="min-w-0 text-stone-600">
                      {item.name}
                      <span className="text-stone-400"> × {item.quantity}</span>
                    </span>
                    <span className="shrink-0 font-medium">{formatIDR(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5 bg-paper p-4 text-sm">
              <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span className="font-medium">{formatIDR(booking.quotation.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Ongkos kirim</span><span className="font-medium">{formatIDR(booking.quotation.deliveryFee)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Biaya layanan / lainnya</span><span className="font-medium">{formatIDR(booking.quotation.serviceFee)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Diskon</span><span className="font-medium text-emerald-700">−{formatIDR(booking.quotation.discount)}</span></div>
              <div className="flex items-baseline justify-between border-t border-stone-200 pt-2">
                <span className="font-bold">Total</span>
                <span className="font-display text-2xl font-bold text-brand-800">{formatIDR(booking.totalAmount)}</span>
              </div>
              <div className="flex justify-between pt-1"><span className="text-stone-500">Sudah dibayar</span><span className="font-semibold text-emerald-700">{formatIDR(paid)}</span></div>
              {paid < booking.totalAmount && (
                <div className="flex justify-between"><span className="text-stone-500">Sisa</span><span className="font-semibold text-amber-700">{formatIDR(booking.totalAmount - paid)}</span></div>
              )}
            </div>
          </div>
        </Card>

        {isCustomer && canPay && paid < booking.totalAmount && (
          <Card className="mt-4 border-brand-100 !bg-gradient-to-b !from-brand-50 !to-white">
            <h2 className="font-display text-2xl text-ink">Bayar lunas via QRIS</h2>
            <p className="text-[13px] text-stone-500">
              Pembayaran hanya satu tahap: lunas sebesar {formatIDR(booking.totalAmount - paid)}.
              Vendor baru mulai persiapan setelah pembayaran diterima.
            </p>
            <form action={createPaymentAction} className="mt-3">
              <input type="hidden" name="bookingId" value={booking.id} />
              <FormButton className="w-full !py-2.5" pendingLabel="Menyiapkan QRIS…">
                Bayar lunas {formatIDR(booking.totalAmount - paid)}
              </FormButton>
            </form>
          </Card>
        )}

        <h2 className="mt-7 font-display text-lg font-bold">Riwayat pembayaran</h2>
        <div className="mt-2.5 space-y-2">
          {booking.payments.map((p) => (
            <Card key={p.id} className="!p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{formatIDR(p.amount)} <span className="font-normal text-stone-400">· QRIS</span></span>
                <StatusBadge status={p.status} />
              </div>
              {p.status === "PENDING" && isCustomer && (
                <p className="mt-1.5 text-sm">
                  <Link href={`/payments/${p.id}`} className="font-semibold text-brand-700 hover:underline">
                    Buka halaman bayar →
                  </Link>
                  {p.expiresAt && (
                    <span className="text-stone-400"> · berlaku s.d. {formatDateTimeID(p.expiresAt)}</span>
                  )}
                </p>
              )}
            </Card>
          ))}
          {booking.payments.length === 0 && <p className="text-sm text-stone-500">Belum ada pembayaran.</p>}
        </div>

        {canCancel && (isCustomer || isVendor) && (
          <div className="mt-6 border-t border-stone-200 pt-4">
            <CancelBookingForm
              bookingId={booking.id}
              returnTo={`/bookings/${booking.id}`}
              consequence={cancelConsequence}
            />
          </div>
        )}
        {isCustomer && PAID_CANCELLABLE.includes(booking.status) && !canCancel && (
          <p className="mt-6 border-t border-stone-200 pt-4 text-xs text-stone-500">
            Pembatalan mandiri hanya tersedia sampai H-{CUSTOMER_CANCEL_MIN_DAYS} acara. Untuk perubahan mendesak, hubungi vendor
            melalui <Link href={`/quotations/${booking.quotationId}#chat`} className="font-semibold text-brand-700 hover:underline">chat pesanan</Link>.
          </p>
        )}

        {canReview && (
          <Card className="mt-4">
            <h2 className="font-display text-2xl text-ink">
              {booking.review ? "Ulasan Anda" : "Bagaimana pengalaman Anda?"}
            </h2>
            {!booking.review && (
              <p className="text-[13px] text-stone-500">
                Pesanan sudah lunas — Anda sudah bisa memberi rating untuk vendor ini.
              </p>
            )}
            {booking.review ? (
              <div className="mt-2">
                <p className="text-xl leading-none text-amber-500" aria-label={`${booking.review.rating} dari 5 bintang`}>
                  {"★".repeat(booking.review.rating)}
                  <span className="text-stone-300">{"★".repeat(5 - booking.review.rating)}</span>
                </p>
                <p className="mt-2 text-sm text-stone-500">
                  Dikirim {formatDateID(booking.review.createdAt)}
                </p>
                {booking.review.comment && (
                  <p className="mt-2 rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed text-stone-700 ring-1 ring-inset ring-stone-200/70">
                    “{booking.review.comment}”
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="text-[13px] text-stone-500">
                  Bantu pelanggan lain dengan menilai kualitas makanan, pelayanan, dan ketepatan waktu vendor ini.
                </p>
                <form action={createBookingReviewAction} className="mt-4 space-y-3">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="vendorId" value={booking.vendor.id} />
                  <StarRatingInput />
                  <Field label="Ceritakan pengalaman Anda (opsional)">
                    <Textarea
                      name="comment"
                      rows={3}
                      maxLength={1000}
                      placeholder="cth. Makanan enak, pramusaji ramah, dan pengiriman tepat waktu."
                    />
                  </Field>
                  <SubmitButton>Kirim ulasan</SubmitButton>
                </form>
              </>
            )}
          </Card>
        )}
      </main>
    </>
  );
}
