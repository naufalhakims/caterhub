import Link from "next/link";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { formatIDR, formatDateID } from "@/lib/format";
import { db } from "@/lib/db";

export default async function AdminOrdersPage() {
  const orders = await db.booking.findMany({
    include: { event: true, vendor: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const gmv = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((s, o) => s + o.totalAmount, 0);
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Pesanan</h1>
      <p className="text-sm text-stone-500">
        {orders.length} pesanan · GMV <span className="font-bold text-stone-700">{formatIDR(gmv)}</span>
      </p>
      {orders.length === 0 ? (
        <div className="mt-4"><Empty title="Belum ada pesanan." hint="Pesanan dari seluruh vendor tampil di sini." /></div>
      ) : (
        <div className="mt-4 space-y-2">
          {orders.map((o) => (
            <Link key={o.id} href={`/bookings/${o.id}`}>
              <Card className="flex items-center justify-between !p-4 transition hover:shadow-lift">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.event.name} — {o.vendor.businessName}</p>
                  <p className="text-sm text-stone-500">{formatDateID(o.event.eventDate)} · {formatIDR(o.totalAmount)}</p>
                </div>
                <StatusBadge status={o.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
