import Link from "next/link";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatIDR, formatDateID } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import { advanceBookingAction } from "@/server/vendor-actions";

const NEXT: Record<string, [string, string][]> = {
  PAYMENT_PENDING: [],
  PAID: [["PREPARING", "Mulai persiapan"]],
  PREPARING: [["READY", "Tandai siap"]],
  READY: [["DELIVERED", "Tandai terkirim"]],
  DELIVERED: [["COMPLETED", "Selesaikan"]],
};

// Status yang masih boleh dibatalkan vendor (lihat VALID_BOOKING_TRANSITIONS).
const CANCELLABLE = new Set(["PAYMENT_PENDING", "CONFIRMED", "PAID", "PREPARING"]);

type VendorOrder = {
  id: string;
  status: string;
  totalAmount: number;
  event: { name: string; guestCount: number; location: string; eventDate: string; eventTime: string | null };
};

export default async function VendorOrdersPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  await requireVendor();
  const orders = await apiGet<VendorOrder[]>("/api/v1/vendor/bookings");

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Pesanan</h1>
      <p className="text-sm text-stone-500">{orders.length} pesanan masuk — majukan status seiring produksi.</p>
      {searchParams?.ok && <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
      {searchParams?.error && <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}
      {orders.length === 0 ? (
        <div className="mt-4">
          <Empty title="Belum ada pesanan." hint="Pesanan muncul setelah Anda mengonfirmasi permintaan pelanggan." />
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {orders.map((o) => (
            <Card key={o.id} className="!p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/bookings/${o.id}`} className="font-semibold hover:text-brand-700 hover:underline">
                    {o.event.name} · {o.event.guestCount} pax
                  </Link>
                  <p className="text-sm text-stone-500">\n                    {formatDateID(o.event.eventDate)}\n                    {o.event.eventTime ? ` · ${o.event.eventTime}` : ""} · {o.event.location}\n                  </p>
                  <p className="mt-0.5 text-sm font-bold">{formatIDR(o.totalAmount)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              {o.status === "PAYMENT_PENDING" && (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                  Menunggu pelanggan membayar lunas. Persiapan baru bisa dimulai setelah pembayaran diterima.
                </p>
              )}
              {(NEXT[o.status] ?? []).length > 0 || CANCELLABLE.has(o.status) ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                  {(NEXT[o.status] ?? []).map(([to, label]) => (
                    <form key={to} action={advanceBookingAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="to" value={to} />
                      <Button type="submit" variant="secondary">{label} →</Button>
                    </form>
                  ))}
                  {CANCELLABLE.has(o.status) && (
                    <form action={advanceBookingAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="to" value="CANCELLED" />
                      <Button type="submit" variant="danger">Batalkan & lepas kapasitas</Button>
                    </form>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
