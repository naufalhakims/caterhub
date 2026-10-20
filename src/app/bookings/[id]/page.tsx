import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatIDR, formatDateID } from "@/lib/format";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { canViewBooking } from "@/server/access";
import { createPaymentAction } from "@/server/payment-actions";

const TRACK: { key: string; label: string }[] = [
  { key: "PAYMENT_PENDING", label: "Menunggu bayar" },
  { key: "PAID", label: "Lunas" },
  { key: "PREPARING", label: "Dipersiapkan" },
  { key: "READY", label: "Siap" },
  { key: "DELIVERED", label: "Terkirim" },
  { key: "COMPLETED", label: "Selesai" },
];

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  const user = await requireUser();
  const booking = await db.booking.findUnique({
    where: { id: params.id },
    include: { event: true, vendor: true, quotation: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!booking) notFound();
  if (!canViewBooking({ id: user.id, role: user.role }, { customerId: booking.customerId, vendorUserId: booking.vendor.userId })) {
    notFound();
  }
  const paid = booking.payments.filter((p) => p.status === "SETTLEMENT").reduce((s, p) => s + p.amount, 0);
  const isCustomer = booking.customerId === user.id;
  const isAdmin = user.role === "ADMIN";
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
          {booking.vendor.businessName} · {formatDateID(booking.event.eventDate)} · {booking.event.guestCount} pax
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
              <dt className="text-xs font-bold uppercase tracking-wide text-stone-400">Penawaran</dt>
              <dd className="mt-0.5"><Link href={`/quotations/${booking.quotationId}`} className="font-semibold text-brand-700 hover:underline">Lihat rincian →</Link></dd>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-[#FAF7F1] p-4 ring-1 ring-inset ring-stone-200/70">
            <div className="flex justify-between text-sm"><span className="text-stone-500">Total pesanan</span><span className="font-bold">{formatIDR(booking.totalAmount)}</span></div>
            <div className="mt-1 flex justify-between text-sm"><span className="text-stone-500">DP (50%)</span><span>{formatIDR(booking.depositAmount)}</span></div>
            <div className="mt-1 flex justify-between text-sm"><span className="text-stone-500">Sudah dibayar</span><span className="font-semibold text-emerald-700">{formatIDR(paid)}</span></div>
            {paid < booking.totalAmount && (
              <>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((paid / booking.totalAmount) * 100)}%` }} />
                </div>
                <p className="mt-1 text-right text-xs text-stone-500">Sisa {formatIDR(booking.totalAmount - paid)}</p>
              </>
            )}
          </div>
        </Card>

        {isCustomer && paid < booking.totalAmount && booking.status !== "CANCELLED" && (
          <Card className="mt-4 border-brand-100 !bg-gradient-to-b !from-brand-50 !to-white">
            <h2 className="font-display text-lg font-bold">Bayar via QRIS</h2>
            <p className="text-[13px] text-stone-500">Pindai QR, status terupdate otomatis setelah pembayaran terkonfirmasi.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {paid < booking.depositAmount && (
                <form action={createPaymentAction} className="flex-1">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="kind" value="deposit" />
                  <Button type="submit" className="w-full !py-2.5">Bayar DP {formatIDR(booking.depositAmount - Math.min(paid, booking.depositAmount))}</Button>
                </form>
              )}
              <form action={createPaymentAction} className="flex-1">
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="kind" value="full" />
                <Button type="submit" variant="secondary" className="w-full !py-2.5">Lunasi {formatIDR(booking.totalAmount - paid)}</Button>
              </form>
            </div>
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
      </main>
    </>
  );
}
