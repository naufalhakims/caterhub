import Link from "next/link";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { formatIDR, formatDateOnlyID } from "@/lib/format";
import { db } from "@/lib/db";
import { requireVendor } from "@/server/vendor-helpers";

export default async function VendorCalendarPage() {
  const { vendor } = await requireVendor();
  const bookings = await db.booking.findMany({
    where: { vendorId: vendor.id, status: { not: "CANCELLED" } },
    include: { event: true },
    orderBy: { event: { eventDate: "asc" } },
  });

  const byDate = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const k = b.event.eventDate.toISOString().slice(0, 10);
    byDate.set(k, [...(byDate.get(k) ?? []), b]);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Kalender produksi</h1>
      <p className="text-sm text-stone-500">Semua acara yang perlu dimasak, diurut dari yang terdekat.</p>
      {byDate.size === 0 ? (
        <div className="mt-4"><Empty title="Belum ada jadwal." hint="Jadwal terisi otomatis dari pesanan yang dikonfirmasi." /></div>
      ) : (
        <div className="mt-4 space-y-5">
          {[...byDate.entries()].map(([date, list]) => {
            const totalPax = list.reduce((s, b) => s + b.event.guestCount, 0);
            return (
              <div key={date}>
                <div className="flex items-baseline gap-2">
                  <p className="font-display text-lg font-bold">{formatDateOnlyID(date)}</p>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                    {list.length} acara · {totalPax} pax
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {list.map((b) => (
                    <Link key={b.id} href={`/bookings/${b.id}`}>
                      <Card className="!p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold leading-tight">{b.event.name}</p>
                          <StatusBadge status={b.status} />
                        </div>
                        <p className="mt-1 text-sm text-stone-500">{b.event.guestCount} pax · {b.event.location}</p>
                        <p className="mt-0.5 text-sm font-bold">{formatIDR(b.totalAmount)}</p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
