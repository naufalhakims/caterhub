import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatIDR } from "@/lib/format";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { canViewPayment } from "@/server/access";

export default async function PaymentPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const payment = await db.payment.findUnique({
    where: { id: params.id },
    include: { booking: { include: { event: true, vendor: true } } },
  });
  if (!payment) notFound();
  if (!canViewPayment({ id: user.id, role: user.role }, { customerId: payment.booking.customerId })) {
    notFound();
  }
  const isMock = payment.provider === "mock";

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Pembayaran QRIS</p>
          <h1 className="mt-1 font-display text-2xl font-bold">{payment.booking.event.name}</h1>
          <p className="text-sm text-stone-500">{payment.booking.vendor.businessName}</p>
        </div>
        <Card className="mt-5 text-center">
          <p className="font-display text-4xl font-bold tracking-tight">{formatIDR(payment.amount)}</p>
          <div className="mt-2"><StatusBadge status={payment.status} /></div>

          <div className="mx-auto mt-5 max-w-[260px] rounded-2xl border-2 border-stone-900 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold tracking-tight">QRIS</p>
              <p className="text-[11px] font-bold text-stone-400">{isMock ? "SANDBOX" : "MIDTRANS"}</p>
            </div>
            {/* Stylized QR stand-in: real payload below for mock */}
            <div className="mx-auto mt-3 grid w-fit grid-cols-7 gap-[3px] rounded-lg bg-white p-2 ring-1 ring-stone-200" aria-hidden>
              {Array.from({ length: 49 }).map((_, i) => {
                const on = (i * 7919 + payment.amount) % 3 !== 0;
                const corner = [0, 1, 2, 5, 6].includes(i % 7) && [0, 1, 5, 6].includes(Math.floor(i / 7) % 7);
                return <span key={i} className={`h-3.5 w-3.5 rounded-[2px] ${corner || on ? "bg-stone-900" : "bg-stone-200"}`} />;
              })}
            </div>
            {isMock && (
              <p className="mt-2 break-all font-mono text-[10px] leading-snug text-stone-400">{payment.qrPayload}</p>
            )}
            {!isMock && (
              <a href={payment.qrPayload ?? "#"} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
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
          {payment.status === "PENDING" && isMock && (
            <form action="/api/payments/mock-settle" method="post" className="mt-4">
              <input type="hidden" name="paymentId" value={payment.id} />
              <Button type="submit" className="w-full !py-2.5">Simulasikan bayar (demo)</Button>
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
