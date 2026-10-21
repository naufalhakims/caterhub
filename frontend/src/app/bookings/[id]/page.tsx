import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { StarRatingInput } from "@/components/ui/StarRatingInput";
import { Field, Textarea } from "@/components/ui/Field";
import { formatIDR, formatDateID } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";
import { createPaymentAction } from "@/server/payment-actions";
import { createBookingReviewAction } from "@/server/booking-actions";

const TRACK: { key: string; label: string }[] = [
  { key: "PAYMENT_PENDING", label: "Menunggu bayar" },
  { key: "PAID", label: "Lunas" },
  { key: "PREPARING", label: "Dipersiapkan" },
  { key: "READY", label: "Siap" },
  { key: "DELIVERED", label: "Terkirim" },
  { key: "COMPLETED", label: "Selesai" },
];

type BookingDetail = {
  id: string;
  status: string;
  totalAmount: number;
  quotationId: string;
  cancelledAt: string | null;
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
  payments: { id: string; amount: number; status: string }[];
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
  // Kembali ke antarmuka peran masing-masing — admin tidak boleh nyasar ke halaman vendor.
  const backHref = isAdmin ? "/admin/orders" : isCustomer ? "/dashboard" : "/vendor/orders";
  const TRACK_KEYS = TRACK.map((t) => t.key);
  const trackIndex = TRACK_KEYS.indexOf(booking.status);
  const legacyPreBooking = ["QUOTATION_PENDING", "QUOTATION_SENT", "REVISION_REQUESTED"].includes(booking.status);
  const progress = trackIndex;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-stone-500">
          <Link href={backHref} className="hover:text-brand-700 hover:underline">← Kembali</Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{booking.event.name}</h1>
          <StatusBadge status={booking.status} />
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {booking.vendor.businessName} · {formatDateID(booking.event.eventDate)}
          {booking.event.eventTime ? ` · ${booking.event.eventTime}` : ""} · {booking.event.guestCount} pax
        </p>
        {searchParams.ok && <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
        {searchParams.error && <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

        {/* Tracker */}
        {booking.status === "CANCELLED" ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-200">
            Pesanan ini dibatalkan{booking.cancelledAt ? ` pada ${formatDateID(booking.cancelledAt)}` : ""}. Kapasitas vendor sudah dikembalikan.
          </p>
        ) : booking.status === "CONFIRMED" ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
            Pesanan sudah dikonfirmasi. Menunggu pembayaran.
          </p>
        ) : legacyPreBooking ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
            Pesanan ini masih berada pada tahap penawaran. Buka rincian penawaran untuk melihat status terbaru.
          </p>
        ) : progress >= 0 ? (
          <Card className="mt-4">
            <ol className="flex items-center">
              {TRACK.map((t, i) => {
                const done = i < progress;
                const cur = i === progress;
                return (
                  <li key={t.key} className={`flex-1 ${i > 0 ? "pl-1" : ""}`}>
                    <div className="flex items-center">
                      {i > 0 && <span className={`h-0.5 flex-1 rounded ${done || cur ? "bg-emerald-500" : "bg-stone-200"}`} />}
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-2 ${
                          done ? "bg-emerald-500 text-white ring-emerald-200"
                          : cur ? "bg-brand-700 text-white ring-brand-200"
                          : "bg-stone-100 text-stone-400 ring-stone-200"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      {i < TRACK.length - 1 && <span className="hidden" />}
                    </div>
                    <p className={`mt-1.5 hidden text-[11px] font-semibold leading-tight sm:block ${done || cur ? "text-stone-800" : "text-stone-400"}`}>
                      {t.label}
                    </p>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs font-semibold text-stone-600 sm:hidden">
              Tahap: {TRACK[progress]?.label}
            </p>
          </Card>
        ) : (
          <p className="mt-4 rounded-xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-700 ring-1 ring-inset ring-stone-200">
            Status pesanan: {booking.status.replaceAll("_", " ").toLowerCase()}.
          </p>
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
            <div className="space-y-1.5 bg-[#FAF7F1] p-4 text-sm">
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
            <h2 className="font-display text-lg font-bold">Bayar lunas via QRIS</h2>
            <p className="text-[13px] text-stone-500">
              Pembayaran hanya satu tahap: lunas sebesar {formatIDR(booking.totalAmount - paid)}.
              Vendor baru mulai persiapan setelah pembayaran diterima.
            </p>
            <form action={createPaymentAction} className="mt-3">
              <input type="hidden" name="bookingId" value={booking.id} />
              <Button type="submit" className="w-full !py-2.5">Bayar lunas {formatIDR(booking.totalAmount - paid)}</Button>
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
                <Link href={`/payments/${p.id}`} className="mt-1.5 inline-block text-sm font-semibold text-brand-700 hover:underline">
                  Buka halaman bayar →
                </Link>
              )}
            </Card>
          ))}
          {booking.payments.length === 0 && <p className="text-sm text-stone-500">Belum ada pembayaran.</p>}
        </div>

        {canReview && (
          <Card className="mt-4">
            <h2 className="font-display text-lg font-bold">
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
                  <p className="mt-2 rounded-xl bg-[#FAF7F1] px-4 py-3 text-sm leading-relaxed text-stone-700 ring-1 ring-inset ring-stone-200/70">
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
